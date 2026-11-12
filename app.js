(() => {
  "use strict";

  const STORE_KEY = "tecnomercado-stock-v1";
  const SESSION_KEY = "tecnomercado-session-user";
  const LOW_STOCK_THRESHOLD = 700;
  const permissionModules = {
    dashboard: "Panel general", inventory: "Inventario", production: "Recetas y producción",
    dailyAssembly: "Producción diaria: armado", dailyMachining: "Producción diaria: mecanizado",
    calculator: "Calculadora", movements: "Movimientos", orders: "Pedidos",
    categories: "Categorías", suppliers: "Proveedores", reports: "Informes y datos"
  };
  const roleNames = { Administrador: "Administrador", "Producción": "Operador de producción", "Depósito": "Depósito", "Compras": "Encargado de compras" };
  const categoryIcons = ["boxes", "gear", "check2-circle", "layers"];
  const defaultData = {
    categories: [
      { id: "cat-raw", name: "Materia prima", color: "blue", description: "Insumos recibidos de proveedores" },
      { id: "cat-wip", name: "En proceso", color: "orange", description: "Piezas en mecanizado y transformación" },
      { id: "cat-finished", name: "Productos terminados", color: "green", description: "Artículos listos para despacho" },
      { id: "cat-supplier", name: "Pieza de proveedores", color: "blue", description: "Piezas y materiales comprados a proveedores" },
      { id: "cat-machined", name: "Pieza de mecanizado", color: "orange", description: "Piezas elaboradas por mecanizado interno" }
    ],
    products: [],
    boms: [],
    orders: [],
    suppliers: [],
    movements: [],
    dailyProduction: [],
    users: [
      { id: "u-1", name: "Jorge Méndez", role: "Administrador", createdAt: new Date().toISOString(), active: true },
      { id: "u-2", name: "Lucía Fernández", role: "Producción", createdAt: new Date(Date.now() - 86400000 * 12).toISOString(), active: true },
      { id: "u-3", name: "Martín Ríos", role: "Depósito", createdAt: new Date(Date.now() - 86400000 * 24).toISOString(), active: true }
    ],
    currentUserId: "u-1",
    audit: []
  };
  let state = loadState();
  let sortState = { key: "name", direction: 1 };
  const modalInstances = {};
  ["productModal", "movementModal", "bomModal", "produceModal", "categoryModal", "userModal", "orderModal", "supplierModal"].forEach(id => {
    modalInstances[id] = new bootstrap.Modal(document.getElementById(id));
  });

  function loadState() {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      const hasSavedProducts = Array.isArray(parsed.products);
      const shouldSeedRecipes = parsed.recipeSeedsInitialized !== true;
      const loaded = { ...structuredClone(defaultData), ...parsed };
      if (!loaded.authVersion) {
        const previousAdmin = loaded.users.find(user => user.role === "Administrador") || defaultData.users[0];
        loaded.users = [{ ...previousAdmin, username: "administrador", role: "Administrador", active: true }];
        loaded.authVersion = 1;
      }
      loaded.dailyProduction = Array.isArray(loaded.dailyProduction) ? loaded.dailyProduction : [];
      loaded.currentUserId = sessionStorage.getItem(SESSION_KEY) || "";
      loaded.categories = Array.isArray(loaded.categories) ? loaded.categories : [];
      defaultData.categories.forEach(category => {
        if (!loaded.categories.some(item => item.name.toLowerCase() === category.name.toLowerCase())) loaded.categories.push(structuredClone(category));
      });
      loaded.products = Array.isArray(loaded.products) ? loaded.products : [];
      loaded.boms = Array.isArray(loaded.boms) ? loaded.boms : [];
      loaded.orders = Array.isArray(loaded.orders) ? loaded.orders : [];
      loaded.suppliers = Array.isArray(loaded.suppliers) ? loaded.suppliers : [];
      const ensureSupplier = (name, leadTimeDays = null) => {
        const supplierName = String(name || "").trim();
        if (!supplierName) return;
        const supplier = loaded.suppliers.find(item => item.name.toLowerCase() === supplierName.toLowerCase());
        const hasSeedDays = leadTimeDays !== null && leadTimeDays !== "" && Number.isFinite(Number(leadTimeDays));
        if (!supplier) loaded.suppliers.push({ id: `supplier-${supplierName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: supplierName, leadTimeDays: hasSeedDays ? Number(leadTimeDays) : null, deliveryDaysCustom: false });
        else if (!supplier.deliveryDaysCustom && supplier.leadTimeDays == null && hasSeedDays) supplier.leadTimeDays = Number(leadTimeDays);
      };
      (window.supplierDeliverySeed || []).forEach(([name, days]) => ensureSupplier(name, days));
      loaded.products.forEach(product => [...(product.supplierOptions || []), product.supplier].forEach(name => ensureSupplier(name)));
      loaded.orders.forEach(order => ensureSupplier(order.supplier));
      (hasSavedProducts ? [] : window.planInventorySeed?.products || []).filter(([, , stock]) => Number(stock) > 0).forEach(([sku, name, stock, min, supplier]) => {
        const existing = loaded.products.find(product => product.sku.toLowerCase() === sku.toLowerCase());
        if (existing) {
          if (!existing.supplier) existing.supplier = supplier;
          return;
        }
        loaded.products.push({
          id: `plan-${sku}`,
          sku,
          name,
          category: supplier === "TECNOMERCADO" ? "Pieza de mecanizado" : "Pieza de proveedores",
          supplier,
          stock: Number(stock),
          min: Number(min),
          unit: "u",
          kind: "simple"
        });
      });
      const parts = window.machiningPartSeed || [];
      const materialProfiles = new Map();
      parts.forEach(([, , barProfile, , supplier]) => {
        if (!materialProfiles.has(barProfile)) materialProfiles.set(barProfile, new Set());
        materialProfiles.get(barProfile).add(supplier);
      });
      const rawMaterials = new Map();
      materialProfiles.forEach((suppliers, barProfile) => {
        const existing = loaded.products.find(product => product.sku.toLowerCase() === barProfile.toLowerCase());
        const barShape = barProfile.startsWith("H") ? "Hexagonal" : barProfile.startsWith("R") ? "Redondo" : "Perfil";
        const profileSlug = barProfile.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const supplierOptions = [...suppliers];
        const rawMaterial = existing || { id: `raw-${profileSlug}`, sku: barProfile, stock: null };
        Object.assign(rawMaterial, {
          name: `Barra ${barShape.toLowerCase()} ${barProfile}`,
          category: "Materia prima",
          supplier: supplierOptions[0],
          supplierOptions,
          purchaseUnit: "kg",
          barProfile,
          barShape,
          min: LOW_STOCK_THRESHOLD,
          unit: "kg",
          kind: "simple",
          rawMaterial: true
        });
        if (!existing) loaded.products.push(rawMaterial);
        rawMaterials.set(barProfile, rawMaterial);
      });
      parts.forEach(([sku, name, barProfile, weightPerPieceGrams, supplier]) => {
        const existing = loaded.products.find(product => product.sku.toLowerCase() === sku.toLowerCase());
        const barShape = barProfile.startsWith("H") ? "Hexagonal" : barProfile.startsWith("R") ? "Redondo" : "Perfil";
        const piece = existing || { id: `piece-${sku}`, sku, stock: null };
        Object.assign(piece, {
          name,
          category: "Pieza de mecanizado",
          supplier,
          barProfile,
          barShape,
          weightPerPieceGrams: Number(weightPerPieceGrams),
          rawMaterialId: rawMaterials.get(barProfile).id,
          min: LOW_STOCK_THRESHOLD,
          unit: "u",
          kind: "simple",
          rawMaterial: false
        });
        if (!existing) loaded.products.push(piece);
      });
      const recipeAliases = {
        ORING005HNBR90: "VM4005",
        ORING011N90: "VM4008",
        NUCLEOFIJO: "VM2076",
        GUIADERESORTE: "VM2082",
        PASTILLAPILOTOO5: "VM3521",
        RESORTECONTRASTE: "VM4522",
        CUERPOMECVALVULADECILINDRO: "VM2070",
        CPOMECVALVULADECARGA: "VM2015",
        CUERPOMECREGULADORTM12: "RMAT3199",
        PERNODE1REVD: "RMAT3016D"
      };
      const recipeSkuByName = new Map((window.planInventorySeed?.products || []).map(([sku, name]) => [normalizeRecipeName(name), sku]));
      const sourceSkuForName = name => recipeAliases[normalizeRecipeName(name)] || recipeSkuByName.get(normalizeRecipeName(name)) || "";
      if (shouldSeedRecipes) {
        (window.recipeSeed || []).forEach(recipe => {
          if (loaded.boms.some(bom => bom.sku.toLowerCase() === recipe.sku.toLowerCase())) return;
          const components = recipe.components.map(([sourceName, qty]) => {
            const normalizedName = normalizeRecipeName(sourceName);
            const sourceSku = sourceSkuForName(sourceName);
            const product = sourceSku
              ? loaded.products.find(item => item.sku.toLowerCase() === sourceSku.toLowerCase())
              : loaded.products.find(item => normalizeRecipeName(item.name) === normalizedName);
            return { productId: product?.id || "", qty: Number(qty), sourceName, sourceSku: product?.sku || sourceSku };
          });
          loaded.boms.push({
            id: `seed-${recipe.sku.toLowerCase()}`,
            sourceRecipe: true,
            productId: `finished-${recipe.sku.toLowerCase()}`,
            name: recipe.name,
            sku: recipe.sku,
            category: "Productos terminados",
            components,
            stock: null,
            min: LOW_STOCK_THRESHOLD,
            unit: "u"
          });
        });
        loaded.recipeSeedsInitialized = true;
      }
      loaded.boms.filter(bom => bom.sourceRecipe).forEach(bom => bom.components.forEach(component => {
        if (!component.sourceSku) component.sourceSku = sourceSkuForName(component.sourceName);
        const product = component.sourceSku && loaded.products.find(item => item.sku.toLowerCase() === component.sourceSku.toLowerCase());
        if (product) component.productId = product.id;
        else if (component.productId && !loaded.products.some(item => item.id === component.productId)) component.productId = "";
      }));
      return loaded;
    } catch (error) {
      console.error("No se pudieron cargar los datos guardados.", error);
      return structuredClone(defaultData);
    }
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (error) { console.error("No se pudieron guardar los cambios.", error); toast("No se pudieron guardar los cambios en este dispositivo.", "error"); }
  }
  function id(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
  function currentUser() { return state.users.find(user => user.id === state.currentUserId && user.active) || null; }
  async function passwordHash(password, salt) {
    if (!window.crypto?.subtle) throw new Error("Este navegador no permite configurar contraseñas en este contexto.");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: Uint8Array.from(salt.match(/../g), value => parseInt(value, 16)), iterations: 210000, hash: "SHA-256" }, key, 256);
    return Array.from(new Uint8Array(bits), value => value.toString(16).padStart(2, "0")).join("");
  }
  async function newPasswordCredential(password) {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
    return { salt, hash: await passwordHash(password, salt) };
  }
  function canView(module) {
    const user = currentUser();
    if (!user) return false;
    if (user.role === "Administrador") return true;
    if (module === "daily") return canView("dailyAssembly") || canView("dailyMachining");
    return Boolean(user.permissions?.[module]?.view);
  }
  function canEdit(module) {
    const user = currentUser();
    return Boolean(user && (user.role === "Administrador" || (user.permissions?.[module]?.view && user.permissions?.[module]?.edit)));
  }
  function supplierByName(name) {
    return state.suppliers.find(supplier => supplier.name.toLowerCase() === String(name || "").trim().toLowerCase());
  }
  function normalizeRecipeName(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[Øø]/g, "O").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function supplierLeadTime(name) {
    const days = supplierByName(name)?.leadTimeDays;
    return Number.isFinite(Number(days)) && days !== null && days !== "" ? Number(days) : null;
  }
  function supplierOptionsForProduct(product) {
    return [...new Set([...(product?.supplierOptions || []), product?.supplier].filter(Boolean))];
  }
  function supplierLeadTimeLabel(product) {
    const suppliers = supplierOptionsForProduct(product);
    if (!suppliers.length) return "Sin plazo";
    return suppliers.map(name => {
      const days = supplierLeadTime(name);
      return `${name}: ${days === null ? "sin plazo" : `${days} días`}`;
    }).join(" / ");
  }
  function addDaysToDate(value, days) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
    date.setDate(date.getDate() + Number(days));
    return localDateKey(date);
  }
  function orderEstimatedDelivery(order) {
    if (order.estimatedDeliveryAt) return order.estimatedDeliveryAt;
    const days = supplierLeadTime(order.supplier);
    return days === null ? "" : addDaysToDate(order.createdAt, days);
  }
  function allowed(action) {
    const modules = { inventory: "inventory", movement: "movements", production: "production", "orders-create": "orders", "orders-manage": "orders", categories: "categories", suppliers: "suppliers", dailyAssembly: "dailyAssembly", dailyMachining: "dailyMachining" };
    if (action === "admin") return currentUser()?.role === "Administrador";
    return modules[action] ? canEdit(modules[action]) : false;
  }
  function requirePermission(action) {
    if (allowed(action)) return true;
    toast(`Tu perfil (${currentUser()?.role || "sin rol"}) no tiene permiso para esta acción.`, "error");
    return false;
  }
  function audit(action, detail) {
    state.audit.unshift({ id: id("a"), date: new Date().toISOString(), user: currentUser()?.name || "Usuario", action, detail });
  }
  function toast(message, type = "success") {
    const element = document.createElement("div");
    element.className = `toast align-items-center toast-${type} show`;
    element.setAttribute("role", "status");
    element.innerHTML = `<div class="d-flex"><div class="toast-body">${escapeHtml(message)}</div><button type="button" class="btn-close me-2 m-auto" aria-label="Cerrar"></button></div>`;
    document.getElementById("toastContainer").append(element);
    element.querySelector(".btn-close").addEventListener("click", () => element.remove());
    window.setTimeout(() => element.remove(), 4200);
  }
  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function fmtNum(value) { return Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 }); }
  function fmtDate(value, withTime = false) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("es-AR", withTime ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }
  function localDateKey(value) {
    const date = new Date(value);
    const pad = number => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  function initials(name = "") { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "U"; }
  function productById(productId) { return state.products.find(product => product.id === productId) || state.boms.find(bom => bom.productId === productId); }
  function availableUnits(bom) {
    if (!bom.components.length) return 0;
    return Math.max(0, Math.floor(Math.min(...bom.components.map(component => {
      const product = state.products.find(item => item.id === component.productId);
      return product && component.qty > 0 ? product.stock / component.qty : 0;
    }))));
  }
  function categoryClass(name) {
    const category = state.categories.find(item => item.name === name);
    return category?.color || "purple";
  }
  function hasStockValue(product) {
    return product.stock !== null && product.stock !== "" && Number.isFinite(Number(product.stock));
  }
  function isLowStock(product) {
    return hasStockValue(product) && Number(product.stock) <= LOW_STOCK_THRESHOLD;
  }
  function stockStatus(product) {
    if (!hasStockValue(product)) return ["Pendiente de carga", "unknown"];
    if (Number(product.stock) <= 0) return ["Agotado", "out"];
    if (Number(product.stock) <= LOW_STOCK_THRESHOLD) return ["Stock bajo", "low"];
    return ["Disponible", "ok"];
  }
  function productIcon(product) {
    return product.kind === "composite" ? "gear-wide-connected" : "box-seam";
  }
  function render() {
    const user = currentUser();
    if (!user) return;
    document.getElementById("sidebarUserName").textContent = user.name;
    document.getElementById("sidebarUserRole").textContent = roleNames[user.role] || user.role;
    document.getElementById("sidebarAvatar").textContent = initials(user.name);
    document.getElementById("topUserName").textContent = user.name;
    document.getElementById("topAvatar").textContent = initials(user.name);
    document.getElementById("welcomeName").textContent = user.name.split(" ")[0];
    const lowStatCard = document.getElementById("statLow").closest(".stat-card");
    lowStatCard.classList.add("stat-link");
    lowStatCard.dataset.action = "view-low-stock";
    lowStatCard.setAttribute("role", "button");
    lowStatCard.tabIndex = 0;
    lowStatCard.setAttribute("aria-label", "Ver productos con stock bajo");
    lowStatCard.querySelector(".stat-foot").innerHTML = `<span class="foot-warning"><i class="bi bi-arrow-down-right"></i> Hasta ${LOW_STOCK_THRESHOLD} unidades</span>`;
    const bomStatCard = document.getElementById("statBoms").closest(".stat-card");
    bomStatCard.classList.add("stat-link");
    bomStatCard.dataset.action = "view-recipes";
    bomStatCard.setAttribute("role", "button");
    bomStatCard.tabIndex = 0;
    bomStatCard.setAttribute("aria-label", "Ver recetas activas en Producción");
    document.getElementById("navProductCount").textContent = state.products.length + state.boms.length;
    document.getElementById("navOrderCount").textContent = state.orders.filter(order => !["Recibido", "Rechazado"].includes(order.status)).length;
    const lowProducts = [...state.products, ...state.boms].filter(isLowStock);
    document.getElementById("statProducts").textContent = fmtNum(state.products.length + state.boms.length);
    document.getElementById("statUnits").textContent = fmtNum([...state.products, ...state.boms].reduce((sum, product) => sum + Number(product.stock), 0));
    document.getElementById("statLow").textContent = fmtNum(lowProducts.length);
    document.getElementById("statBoms").textContent = fmtNum(state.boms.length);
    renderLowStock(lowProducts);
    renderRecentActivity();
    renderInventory();
    renderBoms();
    renderMovements();
    renderOrders();
    renderCategories();
    renderSuppliers();
    renderCalculator();
    renderDailyProduction();
    renderUsers();
    updatePermissionUi();
  }
  function renderLowStock(products) {
    const rows = document.getElementById("lowStockRows");
    document.getElementById("noLowStock").classList.toggle("d-none", products.length > 0);
    rows.closest(".table-responsive").classList.toggle("d-none", products.length === 0);
    const prioritized = [...products].sort((first, second) => Math.max(-1, ...supplierOptionsForProduct(second).map(supplierLeadTime).filter(Number.isFinite)) - Math.max(-1, ...supplierOptionsForProduct(first).map(supplierLeadTime).filter(Number.isFinite)));
    rows.innerHTML = prioritized.slice(0, 4).map(product => {
      const status = stockStatus(product);
      return `<tr><td><div class="product-name-cell"><span class="product-mini-icon ${categoryClass(product.category)}"><i class="bi bi-${productIcon(product)}"></i></span><span><span class="product-title">${escapeHtml(product.name)}</span><span class="product-code">${escapeHtml(product.sku)}</span></span></div></td><td><span class="category-pill ${categoryClass(product.category)}">${escapeHtml(product.category)}</span></td><td><strong class="stock-number ${status[1]}">${hasStockValue(product) ? `${fmtNum(product.stock)} ${escapeHtml(product.unit)}` : "Pendiente"}</strong></td><td>${LOW_STOCK_THRESHOLD} ${escapeHtml(product.unit)}</td><td>${escapeHtml(supplierOptionsForProduct(product).join(" / ") || "Sin proveedor")}</td><td>${escapeHtml(supplierLeadTimeLabel(product))}</td><td><span class="status-pill status-${status[1]}">${status[0]}</span></td></tr>`;
    }).join("");
  }
  function renderRecentActivity() {
    const target = document.getElementById("recentActivity");
    if (!state.movements.length) {
      target.innerHTML = `<div class="empty-state"><span class="empty-icon"><i class="bi bi-arrow-left-right"></i></span><strong>Sin movimientos recientes</strong><span>Registrá una entrada o salida para comenzar.</span></div>`;
      return;
    }
    target.innerHTML = state.movements.slice(0, 5).map(move => {
      const typeClass = move.type === "entrada" ? "in" : move.type === "produccion" ? "prod" : move.type === "ajuste" || move.type === "transferencia" ? "adjust" : "out";
      const sign = move.type === "entrada" ? "+" : move.type === "salida" ? "−" : "";
      const icon = move.type === "entrada" ? "arrow-down-left" : move.type === "produccion" ? "gear" : move.type === "ajuste" ? "sliders" : move.type === "transferencia" ? "arrow-left-right" : "arrow-up-right";
      return `<div class="activity-item"><span class="activity-symbol ${typeClass}"><i class="bi bi-${icon}"></i></span><span class="activity-copy"><strong>${escapeHtml(move.productName)}</strong><small>${escapeHtml(move.user)} · ${fmtDate(move.date, true)}</small></span><span class="activity-qty ${typeClass}">${sign}${fmtNum(move.qty)}</span></div>`;
    }).join("");
  }
  function renderInventory() {
    const search = (document.getElementById("inventorySearch").value || "").trim().toLowerCase();
    const category = document.getElementById("categoryFilter").value;
    const status = document.getElementById("inventoryStatusFilter").value;
    const products = [...state.products, ...state.boms.map(bom => ({ ...bom, id: bom.productId, kind: "composite" }))].filter(product => (!category || product.category === category) && (!search || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(search)) && (!status || (status === "low" && isLowStock(product)) || (status === "out" && stockStatus(product)[1] === "out") || (status === "pending" && !hasStockValue(product))));
    products.sort((a, b) => {
      const first = a[sortState.key], second = b[sortState.key];
      return (typeof first === "number" ? first - second : String(first || "").localeCompare(String(second || ""), "es")) * sortState.direction;
    });
    document.getElementById("inventoryCount").textContent = `${products.length} producto${products.length === 1 ? "" : "s"}`;
    document.getElementById("inventoryEmpty").classList.toggle("d-none", products.length > 0);
    document.getElementById("inventoryRows").closest(".table-responsive").classList.toggle("d-none", products.length === 0);
    document.getElementById("inventoryRows").innerHTML = products.map(product => {
      const [statusText, statusClass] = stockStatus(product);
      const actions = product.kind === "composite"
        ? `<button class="icon-btn" data-action="edit-bom" data-id="${escapeHtml(product.id)}" title="Editar receta" aria-label="Editar receta"><i class="bi bi-pencil"></i></button>`
        : `<button class="icon-btn" data-action="edit-product" data-id="${escapeHtml(product.id)}" title="Editar producto" aria-label="Editar producto"><i class="bi bi-pencil"></i></button><button class="icon-btn" data-action="delete-product" data-id="${escapeHtml(product.id)}" title="Eliminar producto" aria-label="Eliminar producto"><i class="bi bi-trash3"></i></button>`;
      const suppliers = product.rawMaterial ? (product.supplierOptions || [product.supplier]).join(" / ") : product.supplier || "—";
      return `<tr><td><div class="product-name-cell"><span class="product-mini-icon ${categoryClass(product.category)}"><i class="bi bi-${productIcon(product)}"></i></span><span><span class="product-title">${escapeHtml(product.name)}</span>${product.kind === "composite" ? '<span class="product-code">Producto compuesto</span>' : ""}</span></div></td><td>${escapeHtml(product.sku)}</td><td><span class="category-pill ${categoryClass(product.category)}">${escapeHtml(product.category)}</span></td><td>${escapeHtml(product.barProfile || "—")}</td><td>${product.weightPerPieceGrams ? `${fmtNum(product.weightPerPieceGrams)} g` : "—"}</td><td>${escapeHtml(suppliers)}</td><td><strong class="stock-number ${statusClass}">${hasStockValue(product) ? `${fmtNum(product.stock)} ${escapeHtml(product.unit)}` : "Pendiente de carga"}</strong></td><td>${LOW_STOCK_THRESHOLD} ${escapeHtml(product.unit)}</td><td><span class="status-pill status-${statusClass}">${statusText}</span></td><td><div class="row-actions">${actions}</div></td></tr>`;
    }).join("");
  }
  function renderBoms() {
    const target = document.getElementById("bomGrid");
    document.getElementById("bomEmpty").classList.toggle("d-none", state.boms.length > 0);
    target.classList.toggle("d-none", state.boms.length === 0);
    target.innerHTML = state.boms.map(bom => {
      const capacity = availableUnits(bom);
      const components = bom.components.map(component => {
        const product = state.products.find(item => item.id === component.productId);
        const name = product?.name || component.sourceName || "Componente eliminado";
        const stockLabel = !product ? (component.sourceSku ? `SKU ${component.sourceSku} · Pendiente de carga` : "Por vincular") : hasStockValue(product) ? `${fmtNum(product.stock)} ${product.unit} disp.` : "Pendiente de carga";
        return `<div class="bom-component"><span>${escapeHtml(name)} <span class="component-stock">· ${escapeHtml(stockLabel)}</span></span><strong>${fmtNum(component.qty)} ${escapeHtml(product?.unit || "u")}</strong></div>`;
      }).join("");
      const missingSkuCount = bom.components.filter(component => !state.products.some(item => item.id === component.productId) && !component.sourceSku).length;
      const stockPendingCount = bom.components.filter(component => !state.products.some(item => item.id === component.productId) && component.sourceSku).length;
      const pendingLabels = [missingSkuCount ? `${missingSkuCount} por vincular` : "", stockPendingCount ? `${stockPendingCount} pendientes de carga` : ""].filter(Boolean).join(" · ");
      const finishedStock = hasStockValue(bom) ? `${fmtNum(bom.stock)} ${escapeHtml(bom.unit)}` : "Pendiente de carga";
      return `<article class="panel-card bom-card"><div class="bom-top"><span class="bom-product-icon"><i class="bi bi-gear-wide-connected"></i></span><span class="bom-title-wrap"><h2>${escapeHtml(bom.name)}</h2><small>${escapeHtml(bom.sku)} · ${escapeHtml(bom.category)}</small></span><span class="bom-actions"><button class="icon-btn" data-action="edit-bom" data-id="${escapeHtml(bom.id)}" title="Editar receta" aria-label="Editar receta"><i class="bi bi-pencil"></i></button><button class="icon-btn" data-action="delete-bom" data-id="${escapeHtml(bom.id)}" title="Eliminar receta" aria-label="Eliminar receta"><i class="bi bi-trash3"></i></button></span></div><div class="bom-availability"><span>${pendingLabels || "Unidades que podés fabricar ahora"}</span><strong class="${capacity === 0 ? "available-zero" : ""}">${fmtNum(capacity)} <small>unid.</small></strong></div><div class="recipe-title">COMPONENTES POR UNIDAD</div>${components || '<div class="bom-component">Sin componentes configurados</div>'}<div class="bom-footer"><small>Stock terminado: <strong>${finishedStock}</strong></small><button class="btn btn-primary-custom" data-action="produce" data-id="${escapeHtml(bom.id)}"><i class="bi bi-play-fill"></i> Registrar producción</button></div></article>`;
    }).join("");
  }
  function renderMovements() {
    const query = (document.getElementById("movementSearch").value || "").toLowerCase().trim();
    const type = document.getElementById("movementTypeFilter").value;
    const movements = state.movements.filter(move => (!type || move.type === type) && (!query || `${move.productName} ${move.user} ${move.note}`.toLowerCase().includes(query)));
    document.getElementById("movementCount").textContent = `${movements.length} movimiento${movements.length === 1 ? "" : "s"}`;
    document.getElementById("movementEmpty").classList.toggle("d-none", movements.length > 0);
    document.getElementById("movementRows").closest(".table-responsive").classList.toggle("d-none", movements.length === 0);
    document.getElementById("movementRows").innerHTML = movements.map(move => {
      const sign = move.type === "entrada" ? "+" : move.type === "salida" ? "−" : move.type === "produccion" ? "+" : "";
      const label = { entrada: "Entrada", salida: "Salida", ajuste: "Ajuste", transferencia: "Transferencia", produccion: "Producción" }[move.type] || move.type;
      const color = move.type === "entrada" || move.type === "produccion" ? "ok" : move.type === "salida" ? "low" : "";
      return `<tr><td>${fmtDate(move.date, true)}</td><td><span class="product-title">${escapeHtml(move.productName)}</span></td><td><span class="category-pill ${color === "ok" ? "green" : color === "low" ? "orange" : "blue"}">${label}</span></td><td><strong class="stock-number ${color}">${sign}${fmtNum(move.qty)}</strong></td><td>${escapeHtml(move.user)}</td><td>${escapeHtml(move.note || "—")}</td></tr>`;
    }).join("");
  }
  function renderOrders() {
    const sector = document.getElementById("orderSectorFilter").value;
    const status = document.getElementById("orderStatusFilter").value;
    const orders = [...state.orders].filter(order => (!sector || order.sector === sector) && (!status || order.status === status)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    document.getElementById("orderCount").textContent = `${orders.length} pedido${orders.length === 1 ? "" : "s"}`;
    document.getElementById("ordersEmpty").classList.toggle("d-none", orders.length > 0);
    document.getElementById("orderRows").closest(".table-responsive").classList.toggle("d-none", orders.length === 0);
    document.getElementById("orderRows").innerHTML = orders.map(order => {
      const statusClass = { Solicitado: "status-requested", "En gestión": "status-low", Comprado: "status-purchased", Recibido: "status-ok", Rechazado: "status-out" }[order.status] || "status-requested";
      const statusCell = allowed("orders-manage")
        ? `<select class="form-select order-status ${statusClass}" data-id="${escapeHtml(order.id)}" aria-label="Estado del pedido de ${escapeHtml(order.productName)}">${["Solicitado", "En gestión", "Comprado", "Recibido", "Rechazado"].map(option => `<option ${option === order.status ? "selected" : ""}>${option}</option>`).join("")}</select>`
        : `<span class="status-pill ${statusClass}">${escapeHtml(order.status)}</span>`;
      const leadTimeDays = order.leadTimeDays ?? supplierLeadTime(order.supplier);
      const leadTime = leadTimeDays === null ? "Sin informar" : `${fmtNum(leadTimeDays)} días`;
      const estimatedDelivery = orderEstimatedDelivery(order);
      return `<tr><td>${fmtDate(order.createdAt)}</td><td><span class="category-pill ${order.sector === "Mecanizado" ? "orange" : "blue"}">${escapeHtml(order.sector)}</span></td><td><span class="product-title">${escapeHtml(order.productName)}</span><span class="product-code">${escapeHtml(order.sku)}</span></td><td><strong>${fmtNum(order.qty)} ${escapeHtml(order.unit)}</strong></td><td>${escapeHtml(order.supplier || "—")}</td><td>${leadTime}</td><td>${estimatedDelivery ? fmtDate(estimatedDelivery) : "—"}</td><td>${order.neededAt ? fmtDate(order.neededAt) : "—"}</td><td>${statusCell}</td><td>${escapeHtml(order.requestedBy)}</td></tr>`;
    }).join("");
  }
  function renderCategories() {
    const target = document.getElementById("categoryGrid");
    target.innerHTML = state.categories.map((category, index) => {
      const count = state.products.filter(product => product.category === category.name).length + state.boms.filter(bom => bom.category === category.name).length;
      const units = [...state.products, ...state.boms].filter(product => product.category === category.name).reduce((sum, product) => sum + Number(product.stock), 0);
      return `<article class="category-card"><div class="category-card-top"><span class="category-icon ${category.color}"><i class="bi bi-${categoryIcons[index % categoryIcons.length]}"></i></span><span><h2>${escapeHtml(category.name)}</h2><p>${escapeHtml(category.description || "Categoría personalizada")}</p></span><button class="icon-btn ms-auto" data-action="view-category" data-category="${escapeHtml(category.name)}" title="Ver inventario de ${escapeHtml(category.name)}" aria-label="Ver inventario de ${escapeHtml(category.name)}"><i class="bi bi-arrow-up-right-square"></i></button><button class="icon-btn" data-action="edit-category" data-id="${escapeHtml(category.id)}" title="Editar categoría" aria-label="Editar categoría"><i class="bi bi-pencil"></i></button><button class="icon-btn" data-action="delete-category" data-id="${escapeHtml(category.id)}" title="Eliminar categoría" aria-label="Eliminar categoría"><i class="bi bi-trash3"></i></button></div><div class="category-metrics"><span><strong>${count}</strong> producto${count === 1 ? "" : "s"}</span><span><strong>${fmtNum(units)}</strong> unidades</span></div></article>`;
    }).join("");
    const options = state.categories.map(category => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join("");
    document.getElementById("categoryFilter").innerHTML = `<option value="">Todas las categorías</option>${options}`;
  }
  function renderSuppliers() {
    const suppliers = [...state.suppliers].sort((first, second) => first.name.localeCompare(second.name, "es"));
    document.getElementById("suppliersEmpty").classList.toggle("d-none", suppliers.length > 0);
    document.getElementById("supplierRows").closest(".table-responsive").classList.toggle("d-none", suppliers.length === 0);
    document.getElementById("supplierRows").innerHTML = suppliers.map(supplier => {
      const productCount = state.products.filter(product => supplierOptionsForProduct(product).some(name => name.toLowerCase() === supplier.name.toLowerCase())).length;
      const delivery = Number.isFinite(Number(supplier.leadTimeDays)) && supplier.leadTimeDays !== null && supplier.leadTimeDays !== ""
        ? `${fmtNum(supplier.leadTimeDays)} días`
        : "Sin informar";
      return `<tr><td><strong class="product-title">${escapeHtml(supplier.name)}</strong></td><td>${delivery}</td><td>${productCount}</td><td><div class="row-actions"><button class="icon-btn" data-action="edit-supplier" data-id="${escapeHtml(supplier.id)}" title="Editar proveedor" aria-label="Editar proveedor ${escapeHtml(supplier.name)}"><i class="bi bi-pencil"></i></button></div></td></tr>`;
    }).join("");
  }
  function renderCalculator() {
    const select = document.getElementById("calculatorProduct");
    const previous = select.value;
    const products = state.products.filter(product => Number(product.weightPerPieceGrams) > 0 && product.rawMaterial === false);
    select.innerHTML = products.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} · ${escapeHtml(product.sku)} · ${escapeHtml(product.barProfile)}</option>`).join("");
    document.getElementById("calculatorEmpty").classList.toggle("d-none", products.length > 0);
    document.querySelector(".calculator-fields").classList.toggle("d-none", products.length === 0);
    document.getElementById("calculatorSummary").classList.toggle("d-none", products.length === 0);
    document.getElementById("calculatorResult").classList.toggle("d-none", products.length === 0);
    if (!products.length) return;
    if (products.some(product => product.id === previous)) select.value = previous;
    updateCalculatorSummary();
  }
  function updateCalculatorSummary() {
    const product = state.products.find(item => item.id === document.getElementById("calculatorProduct").value);
    if (!product) return;
    const material = state.products.find(item => item.id === product.rawMaterialId);
    document.querySelector(".calculator-profile").textContent = material ? `${material.barShape} · ${material.barProfile}` : `${product.barShape} · ${product.barProfile}`;
    document.getElementById("calculatorWeight").textContent = `${fmtNum(product.weightPerPieceGrams)} g / pieza`;
    const materialSuppliers = (material?.supplierOptions || [material?.supplier]).filter(Boolean).join(" / ");
    const supplierLabel = material && product.supplier !== material.supplier
      ? `Pieza: ${product.supplier} · Barra: ${materialSuppliers}`
      : materialSuppliers || product.supplier;
    document.getElementById("calculatorProvider").textContent = material ? `${supplierLabel} · ${hasStockValue(material) ? `${fmtNum(material.stock)} kg disponibles` : "stock pendiente"}` : product.supplier;
    document.querySelector('label[for="calculatorKg"]').textContent = `Kilos disponibles${material ? ` (${material.sku})` : ""}`;
  }
  function calculatePiecesFromKg() {
    const product = state.products.find(item => item.id === document.getElementById("calculatorProduct").value);
    const kilosInput = document.getElementById("calculatorKg");
    const piecesInput = document.getElementById("calculatorPieces");
    const kilos = Number(kilosInput.value);
    if (!product || !kilosInput.value || !Number.isFinite(kilos) || kilos < 0) { piecesInput.value = ""; document.getElementById("calculatorResult").textContent = "Ingresá kilos para estimar la cantidad de piezas."; return; }
    const pieces = Math.floor(kilos * 1000 / product.weightPerPieceGrams);
    piecesInput.value = pieces;
    const usedKg = pieces * product.weightPerPieceGrams / 1000;
    document.getElementById("calculatorResult").textContent = `${fmtNum(kilos)} kg alcanzan para ${fmtNum(pieces)} piezas teóricas; se usarían ${fmtNum(usedKg)} kg.`;
  }
  function calculateKgFromPieces() {
    const product = state.products.find(item => item.id === document.getElementById("calculatorProduct").value);
    const kilosInput = document.getElementById("calculatorKg");
    const piecesInput = document.getElementById("calculatorPieces");
    const pieces = Number(piecesInput.value);
    if (!product || !piecesInput.value || !Number.isInteger(pieces) || pieces < 0) { kilosInput.value = ""; document.getElementById("calculatorResult").textContent = "Ingresá una cantidad entera de piezas para calcular los kilos necesarios."; return; }
    const kilos = pieces * product.weightPerPieceGrams / 1000;
    kilosInput.value = kilos.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    document.getElementById("calculatorResult").textContent = `${fmtNum(pieces)} piezas requieren ${fmtNum(kilos)} kg de barra.`;
  }
  function renderDailyProduction() {
    const date = document.getElementById("dailyDate").value || localDateKey(new Date());
    const bomSelect = document.getElementById("dailyBom");
    const pieceSelect = document.getElementById("dailyPiece");
    const previousBom = bomSelect.value;
    const previousPiece = pieceSelect.value;
    bomSelect.innerHTML = `<option value="">Seleccionar producto compuesto...</option>${state.boms.map(bom => `<option value="${escapeHtml(bom.id)}">${escapeHtml(bom.name)} · ${escapeHtml(bom.sku)}</option>`).join("")}`;
    pieceSelect.innerHTML = `<option value="">Seleccionar pieza...</option>${state.products.filter(product => product.category === "Pieza de mecanizado").map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} · ${escapeHtml(product.sku)}</option>`).join("")}`;
    bomSelect.value = previousBom;
    pieceSelect.value = previousPiece;
    const assembly = state.dailyProduction.filter(record => record.sector === "armado" && record.date === date);
    const machining = state.dailyProduction.filter(record => record.sector === "mecanizado" && record.date === date);
    const pending = state.dailyProduction.filter(record => record.sector === "mecanizado" && !record.deliveredAt);
    document.getElementById("dailyAssemblyRows").innerHTML = assembly.map(record => `<tr><td>${fmtDate(record.createdAt, true)}</td><td>${escapeHtml(record.productName)}</td><td>${fmtNum(record.qty)} u</td><td>${escapeHtml(record.user)}</td></tr>`).join("");
    document.getElementById("dailyMachiningRows").innerHTML = machining.map(record => `<tr><td>${fmtDate(record.createdAt, true)}</td><td>${escapeHtml(record.productName)}</td><td>${fmtNum(record.qty)} u</td><td>${record.deliveredAt ? "Entregado" : "Pendiente"}</td></tr>`).join("");
    document.getElementById("dailyPendingRows").innerHTML = pending.map(record => `<tr><td>${escapeHtml(record.productName)}<span class="product-code">${escapeHtml(record.sku)}</span></td><td>${fmtNum(record.qty)} u</td><td>${fmtDate(record.date)}</td><td><button class="btn btn-outline-custom" data-action="deliver-machining" data-id="${escapeHtml(record.id)}"><i class="bi bi-check2"></i> Entregado</button></td></tr>`).join("");
    document.getElementById("dailyAssemblyEmpty").classList.toggle("d-none", assembly.length > 0);
    document.getElementById("dailyMachiningEmpty").classList.toggle("d-none", machining.length > 0);
    document.getElementById("dailyPendingEmpty").classList.toggle("d-none", pending.length > 0);
  }
  function renderUsers() {
    document.getElementById("userRows").innerHTML = state.users.map(user => `<tr><td><div class="product-name-cell"><span class="avatar">${escapeHtml(initials(user.name))}</span><span><span class="product-title">${escapeHtml(user.name)}</span><span class="product-code">${escapeHtml(user.username || "")} ${user.id === state.currentUserId ? "· Sesión activa" : ""}</span></span></div></td><td><span class="role-pill ${user.role}">${escapeHtml(roleNames[user.role] || user.role)}</span></td><td>${fmtDate(user.createdAt)}</td><td><span class="status-pill ${user.active ? "status-ok" : "status-out"}">${user.active ? "Activo" : "Inactivo"}</span></td><td><div class="row-actions">${user.role !== "Administrador" ? `<button class="icon-btn" data-action="edit-user" data-id="${escapeHtml(user.id)}" title="Editar permisos" aria-label="Editar permisos"><i class="bi bi-pencil"></i></button>${user.active ? `<button class="icon-btn" data-action="delete-user" data-id="${escapeHtml(user.id)}" title="Desactivar usuario" aria-label="Desactivar usuario"><i class="bi bi-person-dash"></i></button>` : ""}` : ""}</div></td></tr>`).join("");
    document.getElementById("auditRows").innerHTML = state.audit.slice(0, 20).map(item => `<tr><td>${fmtDate(item.date, true)}</td><td>${escapeHtml(item.user)}</td><td><span class="audit-action">${escapeHtml(item.action)}</span></td><td class="audit-details">${escapeHtml(item.detail)}</td></tr>`).join("");
    document.getElementById("auditEmpty").classList.toggle("d-none", state.audit.length > 0);
  }
  function updatePermissionUi() {
    document.querySelectorAll('[data-action="new-product"],[data-action="edit-product"],[data-action="delete-product"]').forEach(button => button.classList.toggle("d-none", !allowed("inventory")));
    document.querySelectorAll('[data-action="new-movement"]').forEach(button => button.classList.toggle("d-none", !allowed("movement")));
    document.querySelectorAll('[data-action="new-order"]').forEach(button => button.classList.toggle("d-none", !allowed("orders-create")));
    document.querySelectorAll('[data-action="new-bom"],[data-action="edit-bom"],[data-action="delete-bom"],[data-action="produce"]').forEach(button => button.classList.toggle("d-none", !allowed("production")));
    document.querySelectorAll('[data-action="new-category"],[data-action="edit-category"],[data-action="delete-category"]').forEach(button => button.classList.toggle("d-none", !allowed("categories")));
    document.querySelectorAll('[data-action="new-user"],[data-action="edit-user"],[data-action="delete-user"]').forEach(button => button.classList.toggle("d-none", !allowed("admin")));
    document.querySelectorAll('[data-action="new-supplier"],[data-action="edit-supplier"]').forEach(button => button.classList.toggle("d-none", !allowed("suppliers")));
    document.getElementById("dailyAssemblyArea").classList.toggle("d-none", !canView("dailyAssembly"));
    document.getElementById("dailyMachiningArea").classList.toggle("d-none", !canView("dailyMachining"));
    document.getElementById("dailyAssemblyForm").classList.toggle("d-none", !allowed("dailyAssembly"));
    document.getElementById("dailyMachiningForm").classList.toggle("d-none", !allowed("dailyMachining"));
    document.querySelectorAll('[data-action="deliver-machining"]').forEach(button => button.classList.toggle("d-none", !allowed("dailyMachining")));
    ["statProducts", "statUnits", "statLow"].forEach(id => document.getElementById(id).closest(".stat-card").classList.toggle("d-none", !canView("inventory")));
    document.getElementById("statBoms").closest(".stat-card").classList.toggle("d-none", !canView("production"));
    document.querySelector(".stock-panel").classList.toggle("d-none", !canView("inventory"));
    document.querySelector(".activity-panel").classList.toggle("d-none", !canView("movements"));
    document.querySelectorAll('.quick-action[data-view]').forEach(button => button.classList.toggle("d-none", !canView(button.dataset.view)));
    document.querySelectorAll('[data-action="export-inventory"],[data-action="print-inventory"]').forEach(button => button.classList.toggle("d-none", !canView("inventory")));
    document.querySelectorAll('[data-action="export-bom"],[data-action="print-bom"]').forEach(button => button.classList.toggle("d-none", !canView("production")));
    document.querySelectorAll('[data-action="export-movements"],[data-action="print-movements"]').forEach(button => button.classList.toggle("d-none", !canView("movements")));
    document.querySelectorAll('[data-action="export-audit"]').forEach(button => button.classList.toggle("d-none", !allowed("admin")));
    document.getElementById("importDrop").closest(".report-card").classList.toggle("d-none", !canEdit("inventory"));
    document.querySelector(".notification-btn").classList.toggle("d-none", !canView("inventory"));
    document.querySelectorAll(".side-nav .nav-link").forEach(button => {
      const view = button.dataset.view;
      const denied = view === "users" ? !allowed("admin") : !canView(view);
      button.classList.toggle("d-none", denied);
    });
  }
  function showView(name) {
    if (name === "users" ? !allowed("admin") : !canView(name)) { toast("No tenés permiso para ver este módulo.", "error"); return; }
    const titles = { dashboard: "Panel general", inventory: "Inventario", production: "Productos compuestos", daily: "Producción diaria", calculator: "Calculadora de piezas", movements: "Movimientos", orders: "Pedidos", categories: "Categorías", suppliers: "Proveedores", reports: "Informes y datos", users: "Usuarios y auditoría" };
    document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
    document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === name));
    document.getElementById("breadcrumbCurrent").textContent = titles[name] || "Gestión";
    document.getElementById("sidebar").classList.remove("open");
    if (name === "inventory") renderInventory();
    if (name === "movements") renderMovements();
    if (name === "orders") renderOrders();
    if (name === "calculator") renderCalculator();
  }
  function fillCategorySelect(selectId, preferred) {
    const select = document.getElementById(selectId);
    select.innerHTML = state.categories.map(category => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join("");
    if (preferred && state.categories.some(category => category.name === preferred)) select.value = preferred;
  }
  function openProduct(productId) {
    if (!requirePermission("inventory")) return;
    const product = state.products.find(item => item.id === productId);
    document.getElementById("productForm").reset();
    document.getElementById("productId").value = product?.id || "";
    document.getElementById("productModalTitle").textContent = product ? "Editar producto" : "Nuevo producto";
    document.getElementById("productName").value = product?.name || "";
    document.getElementById("productSku").value = product?.sku || "";
    fillCategorySelect("productCategory", product?.category);
    document.getElementById("productSupplier").value = product?.supplier || "";
    document.getElementById("productStock").value = product ? (product.stock ?? "") : 0;
    document.getElementById("productMin").value = LOW_STOCK_THRESHOLD;
    document.getElementById("productMin").readOnly = true;
    document.querySelector('label[for="productMin"]').textContent = `Alarma baja fija (${LOW_STOCK_THRESHOLD})`;
    if (product) document.getElementById("productUnit").value = product.unit || "u";
    modalInstances.productModal.show();
  }
  function openOrder() {
    if (!requirePermission("orders-create")) return;
    document.getElementById("orderForm").reset();
    if (!renderOrderProducts()) { toast("No hay productos configurados para este sector.", "error"); return; }
    document.querySelector('label[for="orderQty"]').textContent = "Cantidad *";
    document.getElementById("orderActor").textContent = currentUser().name;
    document.getElementById("orderNeededAt").min = localDateKey(new Date());
    modalInstances.orderModal.show();
  }
  function openSupplier(supplierId = "") {
    if (!requirePermission("suppliers")) return;
    const supplier = state.suppliers.find(item => item.id === supplierId);
    document.getElementById("supplierForm").reset();
    document.getElementById("supplierId").value = supplier?.id || "";
    document.getElementById("supplierName").value = supplier?.name || "";
    document.getElementById("supplierLeadTime").value = supplier?.leadTimeDays ?? "";
    document.getElementById("supplierModalTitle").textContent = supplier ? "Editar proveedor" : "Nuevo proveedor";
    modalInstances.supplierModal.show();
  }
  function renderOrderProducts() {
    const sector = document.getElementById("orderSector").value;
    const isMachining = sector === "Mecanizado";
    const products = isMachining
      ? state.products.filter(product => product.rawMaterial && product.purchaseUnit === "kg")
      : state.products.filter(product => product.category === "Pieza de proveedores");
    const select = document.getElementById("orderProduct");
    select.innerHTML = `<option value="">Seleccionar ${isMachining ? "materia prima" : "pieza de proveedor"}...</option>${products.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} (${escapeHtml(product.sku)}) · ${hasStockValue(product) ? `${fmtNum(product.stock)} ${escapeHtml(product.purchaseUnit || product.unit || "u")}` : "Stock pendiente"}</option>`).join("")}`;
    document.getElementById("orderSupplier").value = "";
    const supplierOptions = document.getElementById("orderSupplierOptions");
    if (supplierOptions) supplierOptions.innerHTML = "";
    document.getElementById("orderEstimatedDelivery").value = "";
    document.querySelector('label[for="orderQty"]').textContent = "Cantidad *";
    document.getElementById("orderDeliveryInfo").textContent = "El plazo del proveedor aparecerá al seleccionar uno.";
    return products.length > 0;
  }
  function updateOrderDelivery() {
    const supplierName = document.getElementById("orderSupplier").value;
    const days = supplierLeadTime(supplierName);
    const estimatedInput = document.getElementById("orderEstimatedDelivery");
    const info = document.getElementById("orderDeliveryInfo");
    info.classList.remove("delivery-warning");
    if (!supplierName || days === null) {
      estimatedInput.value = "";
      info.textContent = supplierName ? "Este proveedor no tiene un plazo informado. Editalo en Proveedores." : "Seleccioná un proveedor para consultar el plazo.";
      return;
    }
    const estimatedDate = addDaysToDate(new Date(), days);
    estimatedInput.value = estimatedDate;
    const neededAt = document.getElementById("orderNeededAt").value;
    if (neededAt && neededAt < estimatedDate) {
      info.classList.add("delivery-warning");
      info.textContent = `Plazo: ${days} días. La entrega estimada (${fmtDate(estimatedDate)}) será posterior a la fecha necesaria.`;
      return;
    }
    info.textContent = `Plazo: ${days} días. Entrega estimada: ${fmtDate(estimatedDate)}.`;
  }
  function openMovement(productId) {
    if (!requirePermission("movement")) return;
    if (!state.products.length && !state.boms.length) { toast("Agregá un producto antes de registrar un movimiento.", "error"); return; }
    const select = document.getElementById("movementProduct");
    const simpleOptions = state.products.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} (${escapeHtml(product.sku)}) · ${hasStockValue(product) ? `${fmtNum(product.stock)} ${escapeHtml(product.unit)}` : "Pendiente de carga"}</option>`);
    const compositeOptions = state.boms.map(bom => `<option value="${escapeHtml(bom.productId)}">${escapeHtml(bom.name)} (${escapeHtml(bom.sku)}) · ${fmtNum(bom.stock)} ${escapeHtml(bom.unit)}</option>`);
    select.innerHTML = [...simpleOptions, ...compositeOptions].join("");
    if (productId) select.value = productId;
    document.getElementById("movementForm").reset();
    if (productId) select.value = productId;
    document.getElementById("movementActor").textContent = currentUser().name;
    fillCategorySelect("transferCategory");
    document.getElementById("transferCategoryWrap").classList.add("d-none");
    document.getElementById("movementQty").disabled = false;
    document.getElementById("movementQty").required = true;
    document.getElementById("movementQtyLabel").textContent = "Cantidad *";
    modalInstances.movementModal.show();
  }
  function addComponentRow(productId = "", qty = 1, sourceName = "", sourceSku = "") {
    const wrapper = document.createElement("div");
    wrapper.className = "component-row";
    const options = state.products.map(product => `<option value="${escapeHtml(product.id)}" ${product.id === productId ? "selected" : ""}>${escapeHtml(product.name)} · ${escapeHtml(product.sku)}</option>`).join("");
    const pending = !productId && sourceName ? `<small class="component-pending">${escapeHtml(sourceName)} · ${sourceSku ? `SKU ${escapeHtml(sourceSku)} pendiente de stock` : "Por vincular"}</small>` : "";
    wrapper.innerHTML = `<div>${pending}<label class="form-label">Componente</label><select class="form-select component-product" required><option value="">Seleccionar producto...</option>${options}</select></div><div><label class="form-label">Cantidad / unidad</label><input class="form-control component-qty" type="number" min="0.01" step="0.01" required value="${escapeHtml(qty)}"></div><button type="button" class="icon-btn remove-component" aria-label="Quitar componente"><i class="bi bi-trash3"></i></button>`;
    wrapper.querySelector(".component-product").addEventListener("change", event => {
      if (event.target.value) wrapper.querySelector(".component-pending")?.remove();
    });
    wrapper.querySelector(".remove-component").addEventListener("click", () => wrapper.remove());
    document.getElementById("componentRows").append(wrapper);
  }
  function openBom(bomId) {
    if (!requirePermission("production")) return;
    if (!state.products.length) { toast("Agregá productos simples que puedan usarse como componentes.", "error"); return; }
    const bom = state.boms.find(item => item.id === bomId);
    document.getElementById("bomForm").reset();
    document.getElementById("bomId").value = bom?.id || "";
    document.getElementById("bomModalTitle").textContent = bom ? "Editar receta" : "Nueva receta";
    document.getElementById("bomName").value = bom?.name || "";
    document.getElementById("bomSku").value = bom?.sku || "";
    fillCategorySelect("bomCategory", bom?.category || "Productos terminados");
    document.getElementById("componentRows").innerHTML = "";
    (bom?.components || [{ productId: "", qty: 1 }]).forEach(component => addComponentRow(component.productId, component.qty, component.sourceName, component.sourceSku));
    modalInstances.bomModal.show();
  }
  function openProduction(bomId) {
    if (!requirePermission("production")) return;
    const bom = state.boms.find(item => item.id === bomId);
    if (!bom) return;
    const capacity = availableUnits(bom);
    document.getElementById("produceBomId").value = bom.id;
    document.getElementById("produceModalTitle").textContent = `Producir ${bom.name}`;
    document.getElementById("produceQty").value = "";
    document.getElementById("produceQty").max = capacity;
    document.getElementById("produceSummary").innerHTML = `<strong>${escapeHtml(bom.name)}</strong><span>${fmtNum(capacity)} unidades disponibles</span>`;
    document.getElementById("produceComponents").innerHTML = bom.components.map(component => {
      const product = state.products.find(item => item.id === component.productId);
      return `${escapeHtml(product?.name || "Componente")}: ${fmtNum(component.qty)} ${escapeHtml(product?.unit || "u")} · stock ${fmtNum(product?.stock || 0)}`;
    }).join("<br>");
    modalInstances.produceModal.show();
  }
  function registerMovement(product, type, qty, note) {
    const previous = Number(product.stock);
    const next = type === "entrada" ? previous + qty : type === "salida" ? previous - qty : qty;
    if (next < 0) throw new Error(`Stock insuficiente de ${product.name}. Disponible: ${fmtNum(previous)} ${product.unit}.`);
    product.stock = next;
    state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: product.productId || product.id, productName: product.name, type, qty: type === "ajuste" ? Math.abs(next - previous) : qty, user: currentUser().name, note: note || "" });
  }
  function registerAssembly(bom, qty) {
    if (!bom || !Number.isInteger(qty) || qty < 1) throw new Error("Ingresá una cantidad entera mayor a cero.");
    if (!hasStockValue(bom)) throw new Error("Primero registrá el stock actual del producto compuesto mediante un ajuste.");
    if (!bom.components.length) throw new Error("La receta no tiene componentes.");
    const requirements = new Map();
    for (const component of bom.components) {
      const product = state.products.find(item => item.id === component.productId);
      const amount = Number(component.qty) * qty;
      if (!product || !Number.isFinite(amount) || amount <= 0) throw new Error(`Componente sin vincular o cantidad inválida: ${component.sourceName || "revisá la receta"}.`);
      requirements.set(product, (requirements.get(product) || 0) + amount);
    }
    requirements.forEach((amount, product) => {
      if (!hasStockValue(product) || product.stock < amount) throw new Error(`Stock insuficiente o pendiente de ${product.name}.`);
    });
    requirements.forEach((amount, product) => registerMovement(product, "salida", amount, `Consumo para producción de ${bom.name}`));
    bom.stock = Number(bom.stock) + qty;
    state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: bom.productId, productName: bom.name, type: "produccion", qty, user: currentUser().name, note: `Producción registrada · ${qty} unidad${qty === 1 ? "" : "es"}` });
  }
  function registerCompositeExit(bom, qty, note) {
    const assembledOnDemand = Math.max(0, qty - Number(bom.stock));
    if (assembledOnDemand > availableUnits(bom)) {
      throw new Error(`Stock insuficiente para ${bom.name}. Hay ${fmtNum(bom.stock)} terminadas y se pueden ensamblar ${fmtNum(availableUnits(bom))} más.`);
    }
    bom.stock = Math.max(0, Number(bom.stock) - qty);
    if (assembledOnDemand > 0) {
      bom.components.forEach(component => {
        const product = state.products.find(item => item.id === component.productId);
        const consumed = component.qty * assembledOnDemand;
        product.stock -= consumed;
        state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: product.id, productName: product.name, type: "salida", qty: consumed, user: currentUser().name, note: `Ensamblaje bajo demanda para salida de ${bom.name}` });
      });
    }
    const buildNote = assembledOnDemand > 0 ? ` · ${fmtNum(assembledOnDemand)} ensambladas a demanda` : "";
    state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: bom.productId, productName: bom.name, type: "salida", qty, user: currentUser().name, note: `${note || "Salida de producto compuesto"}${buildNote}` });
    return assembledOnDemand;
  }
  function setViewTextDefaults() {
    const today = new Date();
    const hour = today.getHours();
    document.getElementById("welcomeGreeting").textContent = hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
    document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short" }).format(today);
    document.getElementById("footerYear").textContent = `· ${today.getFullYear()}`;
    document.querySelector("#view-dashboard .eyebrow").textContent = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(today).toUpperCase();
  }
  function downloadCsv(filename, headers, rows) {
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    downloadBlob(filename, new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  }
  function downloadTable(filename, headers, rows) {
    const format = document.getElementById("exportFormat")?.value || "csv";
    if (format === "xlsx") {
      if (!window.XLSX) { toast("No se pudo cargar el módulo de Excel. Probá exportar como CSV.", "error"); return; }
      const workbook = window.XLSX.utils.book_new();
      const worksheet = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
      window.XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
      const contents = window.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      downloadBlob(filename.replace(/\.csv$/i, ".xlsx"), new Blob([contents], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      return;
    }
    downloadCsv(filename.replace(/\.xlsx$/i, ".csv"), headers, rows);
  }
  function downloadBlob(filename, blob) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  function exportInventory() {
    const products = [...state.products, ...state.boms.map(bom => ({ ...bom, kind: "composite" }))];
    const category = document.getElementById("view-inventory").classList.contains("active") ? document.getElementById("categoryFilter").value : "";
    const filtered = category ? products.filter(product => product.category === category) : products;
    downloadTable("inventario-tecnomercado.csv", ["sku", "nombre", "categoria", "stock", "minimo", "unidad", "tipo", "proveedor", "perfil_barra", "peso_barra_g", "unidad_compra"], filtered.map(p => [p.sku, p.name, p.category, p.stock, p.min, p.unit, p.kind === "composite" ? "compuesto" : "simple", p.supplier || "", p.barProfile || "", p.weightPerPieceGrams || "", p.purchaseUnit || ""]));
  }
  function exportBoms() {
    downloadTable("recetas-tecnomercado.csv", ["sku_producto", "producto", "sku_componente", "componente", "cantidad_por_unidad", "stock_componente", "disponibilidad"], state.boms.flatMap(bom => bom.components.map(component => {
      const product = state.products.find(item => item.id === component.productId);
      return [bom.sku, bom.name, product?.sku || component.sourceSku || "", product?.name || component.sourceName || "Por vincular", component.qty, product && hasStockValue(product) ? product.stock : "", availableUnits(bom)];
    })));
  }
  function exportMovements() {
    const from = document.getElementById("movementFrom").value;
    const to = document.getElementById("movementTo").value;
    if (from && to && from > to) { toast("La fecha «Desde» no puede ser posterior a «Hasta».", "error"); return; }
    const movements = state.movements.filter(move => {
      const date = localDateKey(move.date);
      return (!from || date >= from) && (!to || date <= to);
    });
    downloadTable("movimientos-tecnomercado.csv", ["fecha", "producto", "tipo", "cantidad", "usuario", "nota"], movements.map(move => [move.date, move.productName, move.type, move.qty, move.user, move.note]));
  }
  function exportAudit() {
    const from = document.getElementById("movementFrom").value;
    const to = document.getElementById("movementTo").value;
    if (from && to && from > to) { toast("La fecha «Desde» no puede ser posterior a «Hasta».", "error"); return; }
    const records = state.audit.filter(item => {
      const date = localDateKey(item.date);
      return (!from || date >= from) && (!to || date <= to);
    });
    downloadTable("auditoria-tecnomercado.csv", ["fecha", "usuario", "accion", "detalle"], records.map(item => [item.date, item.user, item.action, item.detail]));
  }
  function exportOrders() {
    const sector = document.getElementById("orderSectorFilter").value;
    const status = document.getElementById("orderStatusFilter").value;
    const orders = state.orders.filter(order => (!sector || order.sector === sector) && (status ? order.status === status : ["Solicitado", "En gestión"].includes(order.status)));
    if (!orders.length) { toast("No hay pedidos para incluir en la lista de compras.", "error"); return; }
    const grouped = new Map();
    orders.forEach(order => {
      const key = `${order.sku.toLowerCase()}|${(order.supplier || "").toLowerCase()}`;
      if (!grouped.has(key)) grouped.set(key, { ...order, qty: 0, sectors: new Set(), statuses: new Set(), requesters: new Set(), notes: new Set(), requests: 0, leadTimeDays: order.leadTimeDays ?? supplierLeadTime(order.supplier), estimatedDeliveryAt: orderEstimatedDelivery(order) });
      const item = grouped.get(key);
      item.qty += Number(order.qty);
      item.requests++;
      item.sectors.add(order.sector);
      item.statuses.add(order.status);
      item.requesters.add(order.requestedBy);
      if (order.note) item.notes.add(order.note);
      if (order.neededAt && (!item.neededAt || order.neededAt < item.neededAt)) item.neededAt = order.neededAt;
      const delivery = orderEstimatedDelivery(order);
      if (delivery && (!item.estimatedDeliveryAt || delivery < item.estimatedDeliveryAt)) item.estimatedDeliveryAt = delivery;
    });
    const rows = [...grouped.values()].map(item => [item.createdAt, item.sku, item.productName, item.qty, item.unit, item.supplier, item.leadTimeDays, item.estimatedDeliveryAt, [...item.sectors].join(" / "), item.neededAt, [...item.statuses].join(" / "), item.requests, [...item.requesters].join(" / "), [...item.notes].join(" / ")]);
    downloadTable("lista-compras-tecnomercado.csv", ["fecha_solicitud", "sku", "producto", "cantidad_total", "unidad", "proveedor", "plazo_dias", "entrega_estimada", "sectores", "necesario_para", "estado", "solicitudes", "solicitantes", "observaciones"], rows);
  }
  function handleImport(file) {
    if (!requirePermission("inventory")) return;
    const result = document.getElementById("importResult");
    result.classList.add("d-none");
    if (!file || file.size > 5 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) {
      toast("Seleccioná un archivo CSV o Excel (.xlsx) válido de hasta 5 MB.", "error"); return;
    }
    const isXlsx = /\.xlsx$/i.test(file.name);
    const reader = new FileReader();
    reader.onerror = () => toast("No se pudo leer el archivo seleccionado.", "error");
    reader.onload = () => {
      try {
        const parseLine = line => {
          const cells = []; let cell = ""; let quoted = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' && quoted && line[i + 1] === '"') { cell += '"'; i++; }
            else if (char === '"') quoted = !quoted;
            else if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
            else cell += char;
          }
          cells.push(cell.trim());
          if (quoted) throw new Error("Hay una comilla sin cerrar en el archivo.");
          return cells;
        };
        let matrix;
        if (isXlsx) {
          if (!window.XLSX) throw new Error("No se pudo cargar el módulo de Excel. Probá guardar la planilla como CSV.");
          const workbook = window.XLSX.read(reader.result, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          if (!firstSheet) throw new Error("El archivo Excel no contiene una hoja de datos.");
          matrix = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: "" });
        } else {
          const lines = String(reader.result).replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
          matrix = lines.map(parseLine);
        }
        matrix = matrix.filter(row => row.some(value => String(value ?? "").trim()));
        if (matrix.length < 2) throw new Error("El archivo no contiene productos para importar.");
        const headers = matrix[0].map(value => String(value ?? "").trim().toLowerCase());
        const required = ["sku", "nombre", "categoria", "stock", "minimo", "unidad"];
        const missing = required.filter(header => !headers.includes(header));
        if (missing.length) throw new Error(`Faltan columnas requeridas: ${missing.join(", ")}.`);
        const rows = matrix.slice(1).map((values, index) => {
          const row = Object.fromEntries(headers.map((header, i) => [header, String(values[i] ?? "").trim()]));
          const stock = Number(row.stock), min = Number(row.minimo);
          if (!row.sku || !row.nombre || !row.categoria || !row.unidad || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(min) || min < 0) throw new Error(`Datos incompletos o inválidos en la fila ${index + 2}.`);
          return { ...row, stock, min };
        });
        const skus = new Set();
        rows.forEach(row => {
          if (skus.has(row.sku.toUpperCase())) throw new Error(`El SKU ${row.sku} está duplicado en el archivo.`);
          if (state.boms.some(bom => bom.sku.toLowerCase() === row.sku.toLowerCase())) throw new Error(`El SKU ${row.sku} ya pertenece a un producto compuesto.`);
          skus.add(row.sku.toUpperCase());
        });
        rows.forEach(row => {
          const existingCategory = state.categories.find(category => category.name.toLowerCase() === row.categoria.toLowerCase());
          if (existingCategory) row.categoria = existingCategory.name;
          else state.categories.push({ id: id("cat"), name: row.categoria, color: "purple", description: "Importada desde CSV" });
        });
        rows.forEach(row => {
          const existing = state.products.find(product => product.sku.toLowerCase() === row.sku.toLowerCase());
          if (existing) {
            const previousStock = existing.stock;
            const previousCategory = existing.category;
            existing.name = row.nombre; existing.category = row.categoria; existing.stock = row.stock; existing.min = LOW_STOCK_THRESHOLD; existing.unit = row.unidad; existing.supplier = row.proveedor || existing.supplier || "";
            existing.barProfile = row.perfil_barra || existing.barProfile || "";
            existing.barShape = existing.barProfile ? (existing.barProfile.startsWith("H") ? "Hexagonal" : existing.barProfile.startsWith("R") ? "Redondo" : "Perfil") : existing.barShape;
            existing.weightPerPieceGrams = Number(row.peso_barra_g || row.peso_tocho_g) || existing.weightPerPieceGrams;
            existing.purchaseUnit = row.unidad_compra || existing.purchaseUnit || "";
            if (previousStock !== row.stock) state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: existing.id, productName: existing.name, type: "ajuste", qty: Math.abs(row.stock - previousStock), user: currentUser().name, note: "Actualización de stock importada desde CSV" });
            if (previousCategory !== row.categoria) state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: existing.id, productName: existing.name, type: "transferencia", qty: row.stock, user: currentUser().name, note: `${previousCategory} → ${row.categoria} · Importación CSV` });
          } else {
            const barProfile = row.perfil_barra || "";
            const product = { id: id("p"), sku: row.sku, name: row.nombre, category: row.categoria, supplier: row.proveedor || "", barProfile, barShape: barProfile.startsWith("H") ? "Hexagonal" : barProfile.startsWith("R") ? "Redondo" : barProfile ? "Perfil" : "", weightPerPieceGrams: Number(row.peso_barra_g || row.peso_tocho_g) || undefined, purchaseUnit: row.unidad_compra || "", stock: row.stock, min: LOW_STOCK_THRESHOLD, unit: row.unidad, kind: "simple" };
            state.products.push(product);
            if (row.stock > 0) state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: product.id, productName: product.name, type: "entrada", qty: row.stock, user: currentUser().name, note: "Stock inicial importado desde CSV" });
          }
        });
        audit("Importación CSV", `${rows.length} productos importados o actualizados`);
        saveState(); render();
        result.textContent = `Importación completada: ${rows.length} productos validados y procesados.`;
        result.classList.remove("d-none");
        toast(`Se procesaron ${rows.length} productos correctamente.`);
      } catch (error) { toast(error.message || "No se pudo procesar el archivo.", "error"); }
    };
    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  }
  function printReport(type) {
    document.querySelectorAll(".view").forEach(view => view.classList.remove("print-active"));
    const view = document.getElementById(type === "inventory" ? "view-inventory" : type === "bom" ? "view-production" : "view-movements");
    view.classList.add("print-active");
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => view.classList.remove("print-active"), 500);
    }, 100);
  }
  function switchUser() {
    if (currentUser()) { audit("Cierre de sesión", currentUser().name); saveState(); }
    sessionStorage.removeItem(SESSION_KEY);
    state.currentUserId = "";
    document.getElementById("loginForm").reset();
    document.getElementById("appShell").hidden = true;
    document.getElementById("loginScreen").hidden = false;
    document.getElementById("loginPassword").focus();
  }
  function updateLoginScreen() {
    const admin = state.users.find(user => user.role === "Administrador");
    const setup = !admin?.credential;
    document.getElementById("loginTitle").textContent = setup ? "Configurar administrador" : "Iniciar sesión";
    document.getElementById("loginSubtitle").textContent = setup ? "Creá la contraseña inicial de la cuenta administrador." : "Ingresá con tu usuario y contraseña.";
    document.getElementById("loginUsername").value = setup ? "administrador" : "";
    document.getElementById("loginUsername").readOnly = setup;
    document.getElementById("loginConfirmWrap").classList.toggle("d-none", !setup);
    document.getElementById("loginConfirm").required = setup;
    document.getElementById("loginPassword").autocomplete = setup ? "new-password" : "current-password";
    document.getElementById("loginSubmit").textContent = setup ? "Crear contraseña e ingresar" : "Ingresar";
  }
  function openUser(userId = "") {
    if (!requirePermission("admin")) return;
    const user = state.users.find(item => item.id === userId && item.role !== "Administrador");
    const form = document.getElementById("userForm");
    form.reset();
    form.dataset.userId = user?.id || "";
    document.getElementById("userModalTitle").textContent = user ? "Editar usuario" : "Agregar usuario";
    document.getElementById("userName").value = user?.name || "";
    document.getElementById("userLogin").value = user?.username || "";
    document.getElementById("userRole").value = user?.role || "Producción";
    document.getElementById("userPassword").required = !user;
    document.getElementById("userPassword").placeholder = user ? "Dejar vacía para conservarla" : "Mínimo 8 caracteres";
    document.getElementById("permissionRows").innerHTML = Object.entries(permissionModules).map(([key, label]) => `<tr><td>${escapeHtml(label)}</td><td><input type="checkbox" class="form-check-input permission-view" data-module="${key}" aria-label="Ver ${escapeHtml(label)}" ${user?.permissions?.[key]?.view ? "checked" : ""}></td><td><input type="checkbox" class="form-check-input permission-edit" data-module="${key}" aria-label="Modificar ${escapeHtml(label)}" ${user?.permissions?.[key]?.edit ? "checked" : ""}></td></tr>`).join("");
    modalInstances.userModal.show();
  }
  document.getElementById("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const admin = state.users.find(user => user.role === "Administrador");
    const username = document.getElementById("loginUsername").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;
    const error = document.getElementById("loginError");
    const submit = document.getElementById("loginSubmit");
    error.classList.add("d-none");
    submit.disabled = true;
    try {
      if (!admin?.credential) {
        if (!admin || password !== document.getElementById("loginConfirm").value) throw new Error("Las contraseñas no coinciden.");
        admin.credential = await newPasswordCredential(password);
      }
      const user = state.users.find(item => item.active && item.username?.toLowerCase() === username);
      if (!user?.credential || await passwordHash(password, user.credential.salt) !== user.credential.hash) throw new Error("Usuario o contraseña incorrectos.");
      state.currentUserId = user.id;
      sessionStorage.setItem(SESSION_KEY, user.id);
      audit("Inicio de sesión", user.name);
      saveState();
      document.getElementById("loginForm").reset();
      document.getElementById("loginScreen").hidden = true;
      document.getElementById("appShell").hidden = false;
      setViewTextDefaults(); render();
      document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
      const firstView = ["dashboard", "daily", "inventory", "production", "calculator", "movements", "orders", "categories", "suppliers", "reports"].find(canView);
      if (firstView) showView(firstView);
      else toast("Tu cuenta aún no tiene módulos habilitados.", "error");
      updateLoginScreen();
    } catch (failure) {
      error.textContent = failure.message || "No se pudo iniciar sesión.";
      error.classList.remove("d-none");
    } finally { submit.disabled = false; }
  });

  document.addEventListener("click", event => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) { showView(viewButton.dataset.view); return; }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const { action, id: itemId } = actionButton.dataset;
    if (action === "view-low-stock") {
      document.getElementById("inventorySearch").value = "";
      document.getElementById("categoryFilter").value = "";
      document.getElementById("inventoryStatusFilter").value = "low";
      showView("inventory");
      renderInventory();
    }
    if (action === "view-recipes") showView("production");
    if (action === "deliver-machining") {
      if (!requirePermission("dailyMachining")) return;
      const record = state.dailyProduction.find(item => item.id === itemId && item.sector === "mecanizado");
      if (!record || record.deliveredAt) { toast("Esta producción ya fue entregada.", "error"); return; }
      const product = state.products.find(item => item.id === record.productId);
      if (!product || !hasStockValue(product)) { toast("Primero registrá el stock actual de la pieza mediante un ajuste.", "error"); return; }
      registerMovement(product, "entrada", record.qty, `Entrega de mecanizado del ${record.date}`);
      record.deliveredAt = new Date().toISOString();
      record.deliveredBy = currentUser().name;
      audit("Entrega de mecanizado", `${record.qty} u · ${record.productName}`);
      saveState(); render(); toast("Piezas entregadas al inventario.");
    }
    if (action === "view-category") {
      document.getElementById("inventorySearch").value = "";
      document.getElementById("categoryFilter").value = actionButton.dataset.category;
      document.getElementById("inventoryStatusFilter").value = "";
      showView("inventory");
      renderInventory();
    }
    if (action === "new-product") openProduct();
    if (action === "edit-product") openProduct(itemId);
    if (action === "delete-product") {
      if (!requirePermission("inventory")) return;
      const product = state.products.find(item => item.id === itemId);
      if (!product) return;
      if (state.boms.some(bom => bom.components.some(component => component.productId === itemId))) { toast("Este producto forma parte de una receta. Quitalo de la receta antes de eliminarlo.", "error"); return; }
      if (window.confirm(`¿Eliminar "${product.name}" del inventario?`)) {
        state.products = state.products.filter(item => item.id !== itemId);
        audit("Producto eliminado", `${product.name} (${product.sku})`); saveState(); render(); toast("Producto eliminado.");
      }
    }
    if (action === "new-movement") openMovement();
    if (action === "new-order") openOrder();
    if (action === "new-bom") openBom();
    if (action === "edit-bom") openBom(itemId);
    if (action === "delete-bom") {
      if (!requirePermission("production")) return;
      const bom = state.boms.find(item => item.id === itemId);
      if (bom && window.confirm(`¿Eliminar la receta "${bom.name}"? El stock terminado se eliminará junto con ella.`)) {
        state.boms = state.boms.filter(item => item.id !== itemId); audit("Receta eliminada", bom.name); saveState(); render(); toast("Receta eliminada.");
      }
    }
    if (action === "produce") openProduction(itemId);
    if (action === "new-category") {
      if (!requirePermission("categories")) return;
      document.getElementById("categoryForm").reset();
      document.getElementById("categoryId").value = "";
      document.getElementById("categoryModalTitle").textContent = "Nueva categoría";
      modalInstances.categoryModal.show();
    }
    if (action === "edit-category") {
      if (!requirePermission("categories")) return;
      const category = state.categories.find(item => item.id === itemId);
      if (!category) return;
      document.getElementById("categoryForm").reset();
      document.getElementById("categoryId").value = category.id;
      document.getElementById("categoryName").value = category.name;
      document.getElementById("categoryColor").value = category.color;
      document.getElementById("categoryModalTitle").textContent = "Editar categoría";
      modalInstances.categoryModal.show();
    }
    if (action === "delete-category") {
      if (!requirePermission("categories")) return;
      const category = state.categories.find(item => item.id === itemId);
      if (!category) return;
      const inUse = state.products.some(product => product.category === category.name) || state.boms.some(bom => bom.category === category.name);
      if (inUse) { toast("No podés eliminar una categoría que contiene productos.", "error"); return; }
      if (window.confirm(`¿Eliminar la categoría "${category.name}"?`)) {
        state.categories = state.categories.filter(item => item.id !== itemId); audit("Categoría eliminada", category.name); saveState(); render(); toast("Categoría eliminada.");
      }
    }
    if (action === "new-supplier") openSupplier();
    if (action === "edit-supplier") openSupplier(itemId);
    if (action === "new-user") openUser();
    if (action === "edit-user") openUser(itemId);
    if (action === "delete-user") {
      if (!requirePermission("admin")) return;
      const user = state.users.find(item => item.id === itemId);
      if (user && user.role !== "Administrador" && user.id !== state.currentUserId && window.confirm(`¿Desactivar el acceso de ${user.name}?`)) {
        user.active = false; audit("Usuario desactivado", `${user.name} (${user.role})`); saveState(); render(); toast("Usuario desactivado.");
      }
    }
    if (action === "export-inventory" && canView("inventory")) exportInventory();
    if (action === "export-bom" && canView("production")) exportBoms();
    if (action === "export-movements" && canView("movements")) exportMovements();
    if (action === "export-audit" && allowed("admin")) exportAudit();
    if (action === "export-orders" && canView("orders")) exportOrders();
    if (action === "download-template" && canEdit("inventory")) downloadCsv("plantilla-importacion-stock.csv", ["sku", "nombre", "categoria", "stock", "minimo", "unidad", "proveedor", "perfil_barra", "peso_barra_g", "unidad_compra"], [["MP-005", "Ejemplo de producto", "Materia prima", 25, 700, "u", "Proveedor ejemplo", "H12", 18.9, "kg"]]);
    if (action === "print-inventory" && canView("inventory")) printReport("inventory");
    if (action === "print-bom" && canView("production")) printReport("bom");
    if (action === "print-movements" && canView("movements")) printReport("movements");
  });

  document.getElementById("productForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!requirePermission("inventory")) return;
    const productId = document.getElementById("productId").value;
    const sku = document.getElementById("productSku").value.trim();
    const duplicate = state.products.some(product => product.sku.toLowerCase() === sku.toLowerCase() && product.id !== productId) || state.boms.some(bom => bom.sku.toLowerCase() === sku.toLowerCase());
    if (duplicate) { toast("Ya existe un producto con ese SKU.", "error"); return; }
    const stock = Number(document.getElementById("productStock").value), min = Number(document.getElementById("productMin").value);
    if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(min) || min < 0) { toast("El stock y el mínimo deben ser números iguales o mayores a cero.", "error"); return; }
    const data = { sku, name: document.getElementById("productName").value.trim(), category: document.getElementById("productCategory").value, supplier: document.getElementById("productSupplier").value.trim(), stock, min, unit: document.getElementById("productUnit").value, kind: "simple" };
    if (productId) {
      const product = state.products.find(item => item.id === productId);
      const previousStock = product.stock;
      const previousCategory = product.category;
      Object.assign(product, data);
      if (previousStock !== stock) {
        state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId, productName: data.name, type: "ajuste", qty: Math.abs(stock - previousStock), user: currentUser().name, note: "Ajuste desde edición de producto" });
      }
      if (previousCategory !== data.category) {
        state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId, productName: data.name, type: "transferencia", qty: stock, user: currentUser().name, note: `${previousCategory} → ${data.category}` });
      }
      audit("Producto actualizado", `${data.name} (${data.sku})${previousCategory !== data.category ? ` · ${previousCategory} → ${data.category}` : ""}`);
    } else {
      const product = { id: id("p"), ...data };
      state.products.push(product);
      if (stock > 0) state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: product.id, productName: product.name, type: "entrada", qty: stock, user: currentUser().name, note: "Stock inicial" });
      audit("Producto creado", `${data.name} (${data.sku})`);
    }
    saveState(); render(); modalInstances.productModal.hide(); toast("Producto guardado correctamente.");
  });
  document.getElementById("movementForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!requirePermission("movement")) return;
    const selectedProductId = document.getElementById("movementProduct").value;
    const product = productById(selectedProductId);
    const type = document.getElementById("movementType").value;
    const qty = type === "transferencia" ? Number(product?.stock) : Number(document.getElementById("movementQty").value);
    if (!product || !Number.isFinite(qty) || (type === "ajuste" ? qty < 0 : type !== "transferencia" && qty <= 0)) { toast("Ingresá una cantidad válida.", "error"); return; }
    const bom = state.boms.find(item => item.productId === selectedProductId);
    if (bom && type === "salida" && !Number.isInteger(qty)) { toast("La salida de productos compuestos se registra en unidades enteras.", "error"); return; }
    const note = document.getElementById("movementNote").value.trim();
    let auditDetail = `${fmtNum(qty)} ${product.unit} · ${product.name}`;
    if (type === "transferencia") {
      const destination = document.getElementById("transferCategory").value;
      if (!destination || destination === product.category) { toast("Elegí una categoría de destino diferente a la actual.", "error"); return; }
      const origin = product.category;
      product.category = destination;
      state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: product.productId || product.id, productName: product.name, type, qty, user: currentUser().name, note: `${origin} → ${destination}${note ? ` · ${note}` : ""}` });
      audit("Transferencia de categoría", `${product.name}: ${origin} → ${destination}`);
    } else if (bom && type === "salida") {
      try {
        const assembledOnDemand = registerCompositeExit(bom, qty, note);
        if (assembledOnDemand) auditDetail += ` · ${fmtNum(assembledOnDemand)} ensambladas a demanda`;
      } catch (error) { toast(error.message, "error"); return; }
    } else {
      try { registerMovement(product, type, qty, note); }
      catch (error) { toast(error.message, "error"); return; }
    }
    if (type !== "transferencia") audit(`Movimiento: ${type}`, auditDetail);
    saveState(); render(); modalInstances.movementModal.hide(); toast("Movimiento registrado correctamente.");
  });
  document.getElementById("orderForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!requirePermission("orders-create")) return;
    const product = state.products.find(item => item.id === document.getElementById("orderProduct").value);
    const qty = Number(document.getElementById("orderQty").value);
    if (!product || !Number.isFinite(qty) || qty <= 0) { toast("Elegí un producto e ingresá una cantidad válida.", "error"); return; }
    const supplierName = document.getElementById("orderSupplier").value.trim();
    const supplier = supplierByName(supplierName);
    if (!supplier) { toast("Elegí un proveedor registrado en la sección Proveedores.", "error"); return; }
    const createdAt = new Date().toISOString();
    const estimatedDeliveryAt = supplier.leadTimeDays === null ? "" : addDaysToDate(createdAt, supplier.leadTimeDays);
    const order = {
      id: id("o"),
      createdAt,
      sector: document.getElementById("orderSector").value,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      qty,
      unit: product.purchaseUnit || product.unit || "u",
      supplier: supplier.name,
      leadTimeDays: supplier.leadTimeDays,
      estimatedDeliveryAt,
      neededAt: document.getElementById("orderNeededAt").value,
      note: document.getElementById("orderNote").value.trim(),
      requestedBy: currentUser().name,
      status: "Solicitado"
    };
    state.orders.unshift(order);
    audit("Pedido enviado a Compras", `${order.sector} · ${fmtNum(qty)} ${order.unit} · ${order.productName}`);
    saveState(); render(); modalInstances.orderModal.hide(); toast("Pedido enviado a Compras.");
  });
  document.getElementById("orderProduct").addEventListener("change", event => {
    const product = state.products.find(item => item.id === event.target.value);
    document.getElementById("orderSupplier").value = product?.supplier || "";
    let supplierOptions = document.getElementById("orderSupplierOptions");
    if (!supplierOptions) {
      supplierOptions = document.createElement("datalist");
      supplierOptions.id = "orderSupplierOptions";
      document.getElementById("orderSupplier").after(supplierOptions);
      document.getElementById("orderSupplier").setAttribute("list", supplierOptions.id);
    }
    const names = supplierOptionsForProduct(product);
    supplierOptions.innerHTML = (names.length ? names : state.suppliers.map(supplier => supplier.name)).map(supplier => `<option value="${escapeHtml(supplier)}"></option>`).join("");
    document.querySelector('label[for="orderQty"]').textContent = `Cantidad${product ? ` (${product.purchaseUnit || product.unit || "u"})` : ""} *`;
    updateOrderDelivery();
  });
  document.getElementById("orderSupplier").addEventListener("input", updateOrderDelivery);
  document.getElementById("orderSupplier").addEventListener("change", updateOrderDelivery);
  document.getElementById("orderNeededAt").addEventListener("change", updateOrderDelivery);
  document.getElementById("orderSector").addEventListener("change", renderOrderProducts);
  document.addEventListener("change", event => {
    if (event.target.matches(".order-status")) {
      if (!requirePermission("orders-manage")) { renderOrders(); return; }
      const order = state.orders.find(item => item.id === event.target.dataset.id);
      if (!order) return;
      const previous = order.status;
      const next = event.target.value;
      if (order.receivedAt && next !== "Recibido") { toast("Un pedido recibido no puede volver a un estado anterior.", "error"); renderOrders(); return; }
      if (next === "Recibido" && !order.receivedAt) {
        const product = state.products.find(item => item.id === order.productId);
        if (!product) { toast("No se encontró el producto asociado al pedido.", "error"); renderOrders(); return; }
        const receivedQty = order.unit === "kg" && Number(product.weightPerPieceGrams) > 0
          ? Math.floor(Number(order.qty) * 1000 / product.weightPerPieceGrams)
          : Number(order.qty);
        if (receivedQty <= 0) { toast("La cantidad recibida no alcanza para una pieza completa.", "error"); renderOrders(); return; }
        const note = order.unit === "kg" && product.weightPerPieceGrams
          ? `Recepción de ${fmtNum(order.qty)} kg · ${fmtNum(receivedQty)} piezas teóricas`
          : `Recepción del pedido ${order.sku}`;
        registerMovement(product, "entrada", receivedQty, note);
        order.receivedAt = new Date().toISOString();
      }
      order.status = next;
      audit("Estado de pedido actualizado", `${order.sku}: ${previous} → ${order.status}`);
      saveState(); render();
    }
  });
  document.getElementById("movementType").addEventListener("change", event => {
    const isTransfer = event.target.value === "transferencia";
    const product = state.products.find(item => item.id === document.getElementById("movementProduct").value);
    document.getElementById("transferCategoryWrap").classList.toggle("d-none", !isTransfer);
    document.getElementById("transferCategory").required = isTransfer;
    document.getElementById("movementQty").disabled = isTransfer;
    document.getElementById("movementQty").min = event.target.value === "ajuste" ? "0" : "0.01";
    document.getElementById("movementQty").required = !isTransfer;
    document.getElementById("movementQtyLabel").textContent = isTransfer ? "Stock a transferir" : "Cantidad *";
    if (isTransfer) {
      document.getElementById("movementQty").value = product?.stock ?? 0;
      document.getElementById("transferCategory").value = state.categories.find(category => category.name !== product?.category)?.name || "";
    }
  });
  document.getElementById("movementProduct").addEventListener("change", () => {
    if (document.getElementById("movementType").value !== "transferencia") return;
    const product = state.products.find(item => item.id === document.getElementById("movementProduct").value);
    document.getElementById("transferCategory").value = state.categories.find(category => category.name !== product?.category)?.name || "";
  });
  document.getElementById("addComponent").addEventListener("click", () => addComponentRow());
  document.getElementById("bomForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!requirePermission("production")) return;
    const bomId = document.getElementById("bomId").value;
    const sku = document.getElementById("bomSku").value.trim();
    if (state.products.some(product => product.sku.toLowerCase() === sku.toLowerCase()) || state.boms.some(bom => bom.sku.toLowerCase() === sku.toLowerCase() && bom.id !== bomId)) { toast("Ya existe un producto con ese SKU.", "error"); return; }
    const components = [...document.querySelectorAll(".component-row")].map(row => ({ productId: row.querySelector(".component-product").value, qty: Number(row.querySelector(".component-qty").value) }));
    if (!components.length || components.some(component => !component.productId || !Number.isFinite(component.qty) || component.qty <= 0)) { toast("Agregá al menos un componente con cantidad válida.", "error"); return; }
    if (new Set(components.map(component => component.productId)).size !== components.length) { toast("No repitas un componente en la receta; sumá sus cantidades en una sola fila.", "error"); return; }
    const productName = document.getElementById("bomName").value.trim();
    if (components.some(component => state.boms.find(bom => bom.id === bomId)?.productId === component.productId)) { toast("Una receta no puede contenerse a sí misma.", "error"); return; }
    const data = { name: productName, sku, category: document.getElementById("bomCategory").value, components, unit: "u", min: 0 };
    if (bomId) {
      const bom = state.boms.find(item => item.id === bomId);
      Object.assign(bom, data);
      audit("Receta actualizada", productName);
    } else {
      const productId = id("p");
      state.boms.push({ id: id("b"), productId, ...data, stock: 0 });
      audit("Receta creada", `${productName} (${sku})`);
    }
    saveState(); render(); modalInstances.bomModal.hide(); toast("Receta guardada correctamente.");
  });
  document.getElementById("produceForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!requirePermission("production")) return;
    const bom = state.boms.find(item => item.id === document.getElementById("produceBomId").value);
    const qty = Number(document.getElementById("produceQty").value);
    try { registerAssembly(bom, qty); }
    catch (error) { toast(error.message, "error"); return; }
    audit("Producción registrada", `${qty} × ${bom.name}`);
    saveState(); render(); modalInstances.produceModal.hide(); toast(`Producción de ${qty} ${qty === 1 ? "unidad" : "unidades"} registrada.`);
  });
  document.getElementById("dailyAssemblyForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!requirePermission("dailyAssembly")) return;
    const bom = state.boms.find(item => item.id === document.getElementById("dailyBom").value);
    const qty = Number(document.getElementById("dailyAssemblyQty").value);
    const date = document.getElementById("dailyDate").value;
    if (!date || date > localDateKey(new Date())) { toast("Elegí una fecha válida que no sea futura.", "error"); return; }
    try { registerAssembly(bom, qty); }
    catch (error) { toast(error.message, "error"); return; }
    state.dailyProduction.unshift({ id: id("daily"), sector: "armado", date, createdAt: new Date().toISOString(), productId: bom.productId, productName: bom.name, sku: bom.sku, qty, user: currentUser().name });
    audit("Armado diario", `${qty} u · ${bom.name} · ${date}`);
    document.getElementById("dailyAssemblyQty").value = "";
    saveState(); render(); toast("Producción de armado registrada.");
  });
  document.getElementById("dailyMachiningForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!requirePermission("dailyMachining")) return;
    const product = state.products.find(item => item.id === document.getElementById("dailyPiece").value && item.category === "Pieza de mecanizado");
    const qty = Number(document.getElementById("dailyMachiningQty").value);
    const date = document.getElementById("dailyDate").value;
    if (!product || !Number.isInteger(qty) || qty < 1 || !date || date > localDateKey(new Date())) { toast("Elegí una pieza, una fecha válida y una cantidad entera mayor a cero.", "error"); return; }
    state.dailyProduction.unshift({ id: id("daily"), sector: "mecanizado", date, createdAt: new Date().toISOString(), productId: product.id, productName: product.name, sku: product.sku, qty, user: currentUser().name, deliveredAt: null });
    audit("Mecanizado diario", `${qty} u · ${product.name} · ${date}`);
    document.getElementById("dailyMachiningQty").value = "";
    saveState(); render(); toast("Producción de mecanizado registrada como pendiente.");
  });
  document.getElementById("dailyDate").addEventListener("change", renderDailyProduction);
  document.getElementById("categoryForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!requirePermission("categories")) return;
    const categoryId = document.getElementById("categoryId").value;
    const name = document.getElementById("categoryName").value.trim();
    if (state.categories.some(category => category.name.toLowerCase() === name.toLowerCase() && category.id !== categoryId)) { toast("Ya existe una categoría con ese nombre.", "error"); return; }
    if (categoryId) {
      const category = state.categories.find(item => item.id === categoryId);
      if (!category) return;
      const previousName = category.name;
      category.name = name;
      category.color = document.getElementById("categoryColor").value;
      state.products.filter(product => product.category === previousName).forEach(product => { product.category = name; });
      state.boms.filter(bom => bom.category === previousName).forEach(bom => { bom.category = name; });
      audit("Categoría actualizada", `${previousName} → ${name}`);
    } else {
      state.categories.push({ id: id("cat"), name, color: document.getElementById("categoryColor").value, description: "Categoría personalizada" });
      audit("Categoría creada", name);
    }
    saveState(); render(); modalInstances.categoryModal.hide(); toast("Categoría guardada.");
  });
  document.getElementById("supplierForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!requirePermission("suppliers")) return;
    const supplierId = document.getElementById("supplierId").value;
    const name = document.getElementById("supplierName").value.trim();
    const leadValue = document.getElementById("supplierLeadTime").value.trim();
    const leadTimeDays = leadValue === "" ? null : Number(leadValue);
    if (leadTimeDays !== null && (!Number.isInteger(leadTimeDays) || leadTimeDays < 0)) { toast("El plazo debe ser un número entero de días o quedar vacío.", "error"); return; }
    if (state.suppliers.some(supplier => supplier.name.toLowerCase() === name.toLowerCase() && supplier.id !== supplierId)) { toast("Ese proveedor ya está registrado.", "error"); return; }
    if (supplierId) {
      const supplier = state.suppliers.find(item => item.id === supplierId);
      if (!supplier) return;
      const previousName = supplier.name;
      supplier.name = name;
      supplier.leadTimeDays = leadTimeDays;
      supplier.deliveryDaysCustom = true;
      state.products.forEach(product => {
        if (product.supplier?.toLowerCase() === previousName.toLowerCase()) product.supplier = name;
        if (Array.isArray(product.supplierOptions)) product.supplierOptions = product.supplierOptions.map(option => option.toLowerCase() === previousName.toLowerCase() ? name : option);
      });
      audit("Proveedor actualizado", `${previousName} → ${name} · ${leadTimeDays === null ? "sin plazo" : `${leadTimeDays} días`}`);
    } else {
      state.suppliers.push({ id: id("supplier"), name, leadTimeDays, deliveryDaysCustom: true });
      audit("Proveedor creado", `${name} · ${leadTimeDays === null ? "sin plazo" : `${leadTimeDays} días`}`);
    }
    saveState(); render(); modalInstances.supplierModal.hide(); toast("Proveedor guardado.");
  });
  document.getElementById("userForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!requirePermission("admin")) return;
    const userId = event.currentTarget.dataset.userId;
    const name = document.getElementById("userName").value.trim();
    const username = document.getElementById("userLogin").value.trim();
    const password = document.getElementById("userPassword").value;
    if (!name || !username || (!userId && password.length < 8) || (password && password.length < 8)) { toast("Completá nombre, usuario y contraseña de al menos 8 caracteres.", "error"); return; }
    if (state.users.some(user => user.username?.toLowerCase() === username.toLowerCase() && user.id !== userId)) { toast("Ya existe un usuario con ese nombre de acceso.", "error"); return; }
    const permissions = Object.fromEntries(Object.keys(permissionModules).map(key => [key, { view: document.querySelector(`.permission-view[data-module="${key}"]`).checked, edit: document.querySelector(`.permission-edit[data-module="${key}"]`).checked }]));
    try {
      const credential = password ? await newPasswordCredential(password) : null;
      const user = state.users.find(item => item.id === userId && item.role !== "Administrador");
      if (user) Object.assign(user, { name, username, role: document.getElementById("userRole").value, permissions, ...(credential ? { credential } : {}) });
      else state.users.push({ id: id("u"), name, username, role: document.getElementById("userRole").value, permissions, credential, createdAt: new Date().toISOString(), active: true });
      audit(user ? "Usuario actualizado" : "Usuario creado", `${name} (${username})`); saveState(); render(); modalInstances.userModal.hide(); toast("Usuario guardado.");
    } catch (error) { toast("No se pudo configurar la contraseña del usuario.", "error"); }
  });
  document.getElementById("permissionRows").addEventListener("change", event => {
    const checkbox = event.target;
    const key = checkbox.dataset.module;
    if (checkbox.classList.contains("permission-edit") && checkbox.checked) document.querySelector(`.permission-view[data-module="${key}"]`).checked = true;
    if (checkbox.classList.contains("permission-view") && !checkbox.checked) document.querySelector(`.permission-edit[data-module="${key}"]`).checked = false;
  });
  document.getElementById("inventorySearch").addEventListener("input", renderInventory);
  document.getElementById("categoryFilter").addEventListener("change", renderInventory);
  document.getElementById("inventoryStatusFilter").addEventListener("change", renderInventory);
  document.getElementById("calculatorProduct").addEventListener("change", () => {
    document.getElementById("calculatorKg").value = "";
    document.getElementById("calculatorPieces").value = "";
    updateCalculatorSummary();
    document.getElementById("calculatorResult").textContent = "Ingresá kilos disponibles o piezas a fabricar.";
  });
  document.getElementById("calculatorKg").addEventListener("input", calculatePiecesFromKg);
  document.getElementById("calculatorPieces").addEventListener("input", calculateKgFromPieces);
  document.getElementById("movementSearch").addEventListener("input", renderMovements);
  document.getElementById("movementTypeFilter").addEventListener("change", renderMovements);
  document.getElementById("orderSectorFilter").addEventListener("change", renderOrders);
  document.getElementById("orderStatusFilter").addEventListener("change", renderOrders);
  document.getElementById("clearFilters").addEventListener("click", () => {
    document.getElementById("inventorySearch").value = "";
    document.getElementById("categoryFilter").value = "";
    document.getElementById("inventoryStatusFilter").value = "";
    renderInventory();
  });
  document.querySelectorAll(".sort-button").forEach(button => button.addEventListener("click", () => {
    const key = button.dataset.sort;
    sortState = { key, direction: sortState.key === key ? -sortState.direction : 1 };
    renderInventory();
  }));
  document.getElementById("chooseImport").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", event => handleImport(event.target.files[0]));
  const importDrop = document.getElementById("importDrop");
  ["dragenter", "dragover"].forEach(type => importDrop.addEventListener(type, event => { event.preventDefault(); importDrop.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(type => importDrop.addEventListener(type, event => { event.preventDefault(); importDrop.classList.remove("dragover"); }));
  importDrop.addEventListener("drop", event => handleImport(event.dataTransfer.files[0]));
  document.getElementById("profileSwitch").addEventListener("click", switchUser);
  document.getElementById("topUserButton").addEventListener("click", switchUser);
  document.getElementById("mobileMenu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.addEventListener("keydown", event => {
    if (event.target.closest(".stat-link") && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.target.closest(".stat-link").click();
    }
  });
  document.addEventListener("click", event => {
    const sidebar = document.getElementById("sidebar");
    if (window.innerWidth <= 900 && sidebar.classList.contains("open") && !sidebar.contains(event.target) && !event.target.closest("#mobileMenu")) sidebar.classList.remove("open");
  });
  window.addEventListener("storage", event => {
    if (event.key === STORE_KEY) {
      state = loadState();
      if (!currentUser()) { switchUser(); updateLoginScreen(); return; }
      render();
      const active = document.querySelector(".view.active")?.id.replace("view-", "");
      if (active && !(active === "users" ? allowed("admin") : canView(active))) {
        document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
        const firstView = Object.keys(permissionModules).find(canView);
        if (firstView) showView(firstView.startsWith("daily") ? "daily" : firstView);
      }
    }
  });
  document.getElementById("dailyDate").value = localDateKey(new Date());
  document.getElementById("dailyDate").max = localDateKey(new Date());
  document.getElementById("profileSwitch").title = "Cerrar sesión";
  document.getElementById("profileSwitch").setAttribute("aria-label", "Cerrar sesión");
  document.getElementById("topUserButton").title = "Cerrar sesión";
  setViewTextDefaults();
  saveState();
  updateLoginScreen();
  if (currentUser() && currentUser().credential) {
    document.getElementById("loginScreen").hidden = true;
    document.getElementById("appShell").hidden = false;
    render();
    document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
    const firstView = ["dashboard", "daily", "inventory", "production", "calculator", "movements", "orders", "categories", "suppliers", "reports"].find(canView);
    if (firstView) showView(firstView);
  } else {
    sessionStorage.removeItem(SESSION_KEY);
    state.currentUserId = "";
  }
  window.setInterval(setViewTextDefaults, 60000);
})();
