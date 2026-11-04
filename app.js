(() => {
  "use strict";

  const STORE_KEY = "tecnomercado-stock-v1";
  const roleNames = { Administrador: "Administrador", "Producción": "Operador de producción", "Depósito": "Depósito" };
  const categoryIcons = ["boxes", "gear", "check2-circle", "layers"];
  const defaultData = {
    categories: [
      { id: "cat-raw", name: "Materia prima", color: "blue", description: "Insumos recibidos de proveedores" },
      { id: "cat-wip", name: "En proceso", color: "orange", description: "Piezas en mecanizado y transformación" },
      { id: "cat-finished", name: "Productos terminados", color: "green", description: "Artículos listos para despacho" }
    ],
    products: [
      { id: "p-1", sku: "MP-001", name: "Placa de acero 2 mm", category: "Materia prima", stock: 145, min: 40, unit: "u", kind: "simple" },
      { id: "p-2", sku: "MP-002", name: "Tornillo hexagonal M8", category: "Materia prima", stock: 32, min: 50, unit: "u", kind: "simple" },
      { id: "p-3", sku: "MP-003", name: "Perfil aluminio 20×20", category: "Materia prima", stock: 86, min: 25, unit: "u", kind: "simple" },
      { id: "p-4", sku: "WIP-001", name: "Soporte mecanizado A", category: "En proceso", stock: 18, min: 15, unit: "u", kind: "simple" },
      { id: "p-5", sku: "PT-001", name: "Base modular reforzada", category: "Productos terminados", stock: 24, min: 10, unit: "u", kind: "simple" },
      { id: "p-6", sku: "MP-004", name: "Pintura epoxi negra", category: "Materia prima", stock: 0, min: 8, unit: "l", kind: "simple" }
    ],
    boms: [
      { id: "b-1", productId: "p-kit", name: "Kit de montaje estándar", sku: "KIT-001", category: "Productos terminados", components: [{ productId: "p-1", qty: 1 }, { productId: "p-2", qty: 4 }, { productId: "p-3", qty: 2 }], stock: 12, min: 5, unit: "u" },
      { id: "b-2", productId: "p-set", name: "Set de soporte industrial", sku: "SET-001", category: "Productos terminados", components: [{ productId: "p-2", qty: 2 }, { productId: "p-4", qty: 1 }], stock: 6, min: 3, unit: "u" }
    ],
    movements: [],
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
  ["productModal", "movementModal", "bomModal", "produceModal", "categoryModal", "userModal"].forEach(id => {
    modalInstances[id] = new bootstrap.Modal(document.getElementById(id));
  });

  function loadState() {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (!saved) return structuredClone(defaultData);
      const parsed = JSON.parse(saved);
      return { ...structuredClone(defaultData), ...parsed };
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
  function currentUser() { return state.users.find(user => user.id === state.currentUserId) || state.users[0]; }
  function allowed(action) {
    const role = currentUser()?.role;
    if (role === "Administrador") return true;
    if (role === "Producción") return ["production", "view"].includes(action);
    if (role === "Depósito") return ["inventory", "movement", "view"].includes(action);
    return false;
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
    const date = new Date(value);
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
  function stockStatus(product) {
    if (Number(product.stock) <= 0) return ["Agotado", "out"];
    if (Number(product.stock) <= Number(product.min)) return ["Stock bajo", "low"];
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
    document.getElementById("navProductCount").textContent = state.products.length + state.boms.length;
    const lowProducts = [...state.products, ...state.boms].filter(product => product.stock <= product.min);
    document.getElementById("statProducts").textContent = fmtNum(state.products.length + state.boms.length);
    document.getElementById("statUnits").textContent = fmtNum([...state.products, ...state.boms].reduce((sum, product) => sum + Number(product.stock), 0));
    document.getElementById("statLow").textContent = fmtNum(lowProducts.length);
    document.getElementById("statBoms").textContent = fmtNum(state.boms.length);
    renderLowStock(lowProducts);
    renderRecentActivity();
    renderInventory();
    renderBoms();
    renderMovements();
    renderCategories();
    renderUsers();
    updatePermissionUi();
  }
  function renderLowStock(products) {
    const rows = document.getElementById("lowStockRows");
    document.getElementById("noLowStock").classList.toggle("d-none", products.length > 0);
    rows.closest(".table-responsive").classList.toggle("d-none", products.length === 0);
    rows.innerHTML = products.slice(0, 4).map(product => {
      const status = stockStatus(product);
      return `<tr><td><div class="product-name-cell"><span class="product-mini-icon ${categoryClass(product.category)}"><i class="bi bi-${productIcon(product)}"></i></span><span><span class="product-title">${escapeHtml(product.name)}</span><span class="product-code">${escapeHtml(product.sku)}</span></span></div></td><td><span class="category-pill ${categoryClass(product.category)}">${escapeHtml(product.category)}</span></td><td><strong class="stock-number ${status[1]}">${fmtNum(product.stock)} ${escapeHtml(product.unit)}</strong></td><td>${fmtNum(product.min)} ${escapeHtml(product.unit)}</td><td><span class="status-pill status-${status[1]}">${status[0]}</span></td></tr>`;
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
    const products = [...state.products, ...state.boms.map(bom => ({ ...bom, id: bom.productId, kind: "composite" }))].filter(product => (!category || product.category === category) && (!search || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(search)));
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
      return `<tr><td><div class="product-name-cell"><span class="product-mini-icon ${categoryClass(product.category)}"><i class="bi bi-${productIcon(product)}"></i></span><span><span class="product-title">${escapeHtml(product.name)}</span>${product.kind === "composite" ? '<span class="product-code">Producto compuesto</span>' : ""}</span></div></td><td>${escapeHtml(product.sku)}</td><td><span class="category-pill ${categoryClass(product.category)}">${escapeHtml(product.category)}</span></td><td><strong class="stock-number ${statusClass}">${fmtNum(product.stock)} ${escapeHtml(product.unit)}</strong></td><td>${fmtNum(product.min)} ${escapeHtml(product.unit)}</td><td><span class="status-pill status-${statusClass}">${statusText}</span></td><td><div class="row-actions">${actions}</div></td></tr>`;
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
        return `<div class="bom-component"><span>${escapeHtml(product?.name || "Componente eliminado")} <span class="component-stock">· ${fmtNum(product?.stock || 0)} disp.</span></span><strong>${fmtNum(component.qty)} ${escapeHtml(product?.unit || "u")}</strong></div>`;
      }).join("");
      return `<article class="panel-card bom-card"><div class="bom-top"><span class="bom-product-icon"><i class="bi bi-gear-wide-connected"></i></span><span class="bom-title-wrap"><h2>${escapeHtml(bom.name)}</h2><small>${escapeHtml(bom.sku)} · ${escapeHtml(bom.category)}</small></span><span class="bom-actions"><button class="icon-btn" data-action="edit-bom" data-id="${escapeHtml(bom.id)}" title="Editar receta" aria-label="Editar receta"><i class="bi bi-pencil"></i></button><button class="icon-btn" data-action="delete-bom" data-id="${escapeHtml(bom.id)}" title="Eliminar receta" aria-label="Eliminar receta"><i class="bi bi-trash3"></i></button></span></div><div class="bom-availability"><span>Unidades que podés fabricar ahora</span><strong class="${capacity === 0 ? "available-zero" : ""}">${fmtNum(capacity)} <small>unid.</small></strong></div><div class="recipe-title">COMPONENTES POR UNIDAD</div>${components || '<div class="bom-component">Sin componentes configurados</div>'}<div class="bom-footer"><small>Stock terminado: <strong>${fmtNum(bom.stock)} ${escapeHtml(bom.unit)}</strong></small><button class="btn btn-primary-custom" data-action="produce" data-id="${escapeHtml(bom.id)}"><i class="bi bi-play-fill"></i> Registrar producción</button></div></article>`;
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
  function renderCategories() {
    const target = document.getElementById("categoryGrid");
    target.innerHTML = state.categories.map((category, index) => {
      const count = state.products.filter(product => product.category === category.name).length + state.boms.filter(bom => bom.category === category.name).length;
      const units = [...state.products, ...state.boms].filter(product => product.category === category.name).reduce((sum, product) => sum + Number(product.stock), 0);
      return `<article class="category-card"><div class="category-card-top"><span class="category-icon ${category.color}"><i class="bi bi-${categoryIcons[index % categoryIcons.length]}"></i></span><span><h2>${escapeHtml(category.name)}</h2><p>${escapeHtml(category.description || "Categoría personalizada")}</p></span><button class="icon-btn ms-auto" data-action="edit-category" data-id="${escapeHtml(category.id)}" title="Editar categoría" aria-label="Editar categoría"><i class="bi bi-pencil"></i></button><button class="icon-btn" data-action="delete-category" data-id="${escapeHtml(category.id)}" title="Eliminar categoría" aria-label="Eliminar categoría"><i class="bi bi-trash3"></i></button></div><div class="category-metrics"><span><strong>${count}</strong> producto${count === 1 ? "" : "s"}</span><span><strong>${fmtNum(units)}</strong> unidades</span></div></article>`;
    }).join("");
    const options = state.categories.map(category => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join("");
    document.getElementById("categoryFilter").innerHTML = `<option value="">Todas las categorías</option>${options}`;
  }
  function renderUsers() {
    const userOptions = state.users.filter(user => user.active);
    if (!userOptions.some(user => user.id === state.currentUserId)) state.currentUserId = userOptions[0]?.id || "";
    document.getElementById("userRows").innerHTML = state.users.map(user => `<tr><td><div class="product-name-cell"><span class="avatar">${escapeHtml(initials(user.name))}</span><span><span class="product-title">${escapeHtml(user.name)}</span><span class="product-code">${user.id === state.currentUserId ? "Usuario activo" : "Acceso al sistema"}</span></span></div></td><td><span class="role-pill ${user.role}">${escapeHtml(roleNames[user.role] || user.role)}</span></td><td>${fmtDate(user.createdAt)}</td><td><span class="status-pill ${user.active ? "status-ok" : "status-out"}">${user.active ? "Activo" : "Inactivo"}</span></td><td><div class="row-actions">${user.id !== state.currentUserId && state.users.filter(item => item.active).length > 1 ? `<button class="icon-btn" data-action="delete-user" data-id="${escapeHtml(user.id)}" title="Desactivar usuario" aria-label="Desactivar usuario"><i class="bi bi-person-dash"></i></button>` : ""}</div></td></tr>`).join("");
    document.getElementById("auditRows").innerHTML = state.audit.slice(0, 20).map(item => `<tr><td>${fmtDate(item.date, true)}</td><td>${escapeHtml(item.user)}</td><td><span class="audit-action">${escapeHtml(item.action)}</span></td><td class="audit-details">${escapeHtml(item.detail)}</td></tr>`).join("");
    document.getElementById("auditEmpty").classList.toggle("d-none", state.audit.length > 0);
  }
  function updatePermissionUi() {
    document.querySelectorAll('[data-action="new-product"],[data-action="edit-product"],[data-action="delete-product"]').forEach(button => button.classList.toggle("d-none", !allowed("inventory")));
    document.querySelectorAll('[data-action="new-movement"]').forEach(button => button.classList.toggle("d-none", !allowed("movement")));
    document.querySelectorAll('[data-action="new-bom"],[data-action="edit-bom"],[data-action="delete-bom"],[data-action="produce"]').forEach(button => button.classList.toggle("d-none", !allowed("production")));
    document.querySelectorAll('[data-action="new-category"],[data-action="edit-category"],[data-action="new-user"],[data-action="delete-category"],[data-action="delete-user"]').forEach(button => button.classList.toggle("d-none", !allowed("admin")));
    document.querySelectorAll(".side-nav .nav-link").forEach(button => {
      const view = button.dataset.view;
      const denied = (view === "users" || view === "categories") && !allowed("admin");
      button.classList.toggle("d-none", denied);
    });
  }
  function showView(name) {
    const titles = { dashboard: "Panel general", inventory: "Inventario", production: "Productos compuestos", movements: "Movimientos", categories: "Categorías", reports: "Informes y datos", users: "Usuarios y auditoría" };
    document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
    document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === name));
    document.getElementById("breadcrumbCurrent").textContent = titles[name] || "Gestión";
    document.getElementById("sidebar").classList.remove("open");
    if (name === "inventory") renderInventory();
    if (name === "movements") renderMovements();
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
    document.getElementById("productStock").value = product?.stock ?? 0;
    document.getElementById("productMin").value = product?.min ?? 5;
    if (product) document.getElementById("productUnit").value = product.unit || "u";
    modalInstances.productModal.show();
  }
  function openMovement(productId) {
    if (!requirePermission("movement")) return;
    if (!state.products.length && !state.boms.length) { toast("Agregá un producto antes de registrar un movimiento.", "error"); return; }
    const select = document.getElementById("movementProduct");
    const simpleOptions = state.products.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} (${escapeHtml(product.sku)}) · ${fmtNum(product.stock)} ${escapeHtml(product.unit)}</option>`);
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
  function addComponentRow(productId = "", qty = 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "component-row";
    const options = state.products.map(product => `<option value="${escapeHtml(product.id)}" ${product.id === productId ? "selected" : ""}>${escapeHtml(product.name)} · ${escapeHtml(product.sku)}</option>`).join("");
    wrapper.innerHTML = `<div><label class="form-label">Componente</label><select class="form-select component-product" required><option value="">Seleccionar producto...</option>${options}</select></div><div><label class="form-label">Cantidad / unidad</label><input class="form-control component-qty" type="number" min="0.01" step="0.01" required value="${escapeHtml(qty)}"></div><button type="button" class="icon-btn remove-component" aria-label="Quitar componente"><i class="bi bi-trash3"></i></button>`;
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
    (bom?.components || [{ productId: "", qty: 1 }]).forEach(component => addComponentRow(component.productId, component.qty));
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
    downloadTable("inventario-tecnomercado.csv", ["sku", "nombre", "categoria", "stock", "minimo", "unidad", "tipo"], filtered.map(p => [p.sku, p.name, p.category, p.stock, p.min, p.unit, p.kind === "composite" ? "compuesto" : "simple"]));
  }
  function exportBoms() {
    downloadTable("recetas-tecnomercado.csv", ["sku_producto", "producto", "sku_componente", "componente", "cantidad_por_unidad", "stock_componente", "disponibilidad"], state.boms.flatMap(bom => bom.components.map(component => {
      const product = state.products.find(item => item.id === component.productId);
      return [bom.sku, bom.name, product?.sku || "", product?.name || "", component.qty, product?.stock || 0, availableUnits(bom)];
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
            existing.name = row.nombre; existing.category = row.categoria; existing.stock = row.stock; existing.min = row.min; existing.unit = row.unidad;
            if (previousStock !== row.stock) state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: existing.id, productName: existing.name, type: "ajuste", qty: Math.abs(row.stock - previousStock), user: currentUser().name, note: "Actualización de stock importada desde CSV" });
            if (previousCategory !== row.categoria) state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: existing.id, productName: existing.name, type: "transferencia", qty: row.stock, user: currentUser().name, note: `${previousCategory} → ${row.categoria} · Importación CSV` });
          } else {
            const product = { id: id("p"), sku: row.sku, name: row.nombre, category: row.categoria, stock: row.stock, min: row.min, unit: row.unidad, kind: "simple" };
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
    const options = state.users.filter(user => user.active);
    if (options.length < 2) { toast("Agregá otro usuario para cambiar el perfil.", "error"); return; }
    const selector = document.createElement("select");
    selector.className = "form-select";
    selector.setAttribute("aria-label", "Seleccionar usuario activo");
    selector.innerHTML = options.map(user => `<option value="${escapeHtml(user.id)}" ${user.id === state.currentUserId ? "selected" : ""}>${escapeHtml(user.name)} — ${escapeHtml(user.role)}</option>`).join("");
    const container = document.createElement("div");
    container.className = "p-3";
    container.innerHTML = `<label class="form-label" for="userSwitchSelect">Cambiar usuario activo</label>`;
    container.append(selector);
    const toastElement = document.createElement("div");
    toastElement.className = "toast show";
    toastElement.style.cssText = "position:fixed;right:20px;top:20px;z-index:2000;min-width:280px;background:#fff";
    toastElement.append(container);
    document.body.append(toastElement);
    selector.addEventListener("change", () => {
      state.currentUserId = selector.value;
      audit("Cambio de usuario", `Perfil activo: ${currentUser().role}`);
      saveState(); render(); toastElement.remove();
      toast(`Usuario activo: ${currentUser().name}`);
    });
    selector.addEventListener("blur", () => window.setTimeout(() => toastElement.remove(), 2500));
    selector.focus();
  }

  document.addEventListener("click", event => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) { showView(viewButton.dataset.view); return; }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const { action, id: itemId } = actionButton.dataset;
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
      if (!requirePermission("admin")) return;
      document.getElementById("categoryForm").reset();
      document.getElementById("categoryId").value = "";
      document.getElementById("categoryModalTitle").textContent = "Nueva categoría";
      modalInstances.categoryModal.show();
    }
    if (action === "edit-category") {
      if (!requirePermission("admin")) return;
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
      if (!requirePermission("admin")) return;
      const category = state.categories.find(item => item.id === itemId);
      if (!category) return;
      const inUse = state.products.some(product => product.category === category.name) || state.boms.some(bom => bom.category === category.name);
      if (inUse) { toast("No podés eliminar una categoría que contiene productos.", "error"); return; }
      if (window.confirm(`¿Eliminar la categoría "${category.name}"?`)) {
        state.categories = state.categories.filter(item => item.id !== itemId); audit("Categoría eliminada", category.name); saveState(); render(); toast("Categoría eliminada.");
      }
    }
    if (action === "new-user") {
      if (!requirePermission("admin")) return;
      document.getElementById("userForm").reset(); modalInstances.userModal.show();
    }
    if (action === "delete-user") {
      if (!requirePermission("admin")) return;
      const user = state.users.find(item => item.id === itemId);
      if (user && window.confirm(`¿Desactivar el acceso de ${user.name}?`)) {
        user.active = false; audit("Usuario desactivado", `${user.name} (${user.role})`); saveState(); render(); toast("Usuario desactivado.");
      }
    }
    if (action === "export-inventory") exportInventory();
    if (action === "export-bom") exportBoms();
    if (action === "export-movements") exportMovements();
    if (action === "export-audit") exportAudit();
    if (action === "download-template") downloadCsv("plantilla-importacion-stock.csv", ["sku", "nombre", "categoria", "stock", "minimo", "unidad"], [["MP-005", "Ejemplo de producto", "Materia prima", 25, 5, "u"]]);
    if (action === "print-inventory") printReport("inventory");
    if (action === "print-bom") printReport("bom");
    if (action === "print-movements") printReport("movements");
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
    const data = { sku, name: document.getElementById("productName").value.trim(), category: document.getElementById("productCategory").value, stock, min, unit: document.getElementById("productUnit").value, kind: "simple" };
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
    if (!product || !Number.isFinite(qty) || (type !== "transferencia" && qty <= 0)) { toast("Ingresá una cantidad válida mayor a cero.", "error"); return; }
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
  document.getElementById("movementType").addEventListener("change", event => {
    const isTransfer = event.target.value === "transferencia";
    const product = state.products.find(item => item.id === document.getElementById("movementProduct").value);
    document.getElementById("transferCategoryWrap").classList.toggle("d-none", !isTransfer);
    document.getElementById("transferCategory").required = isTransfer;
    document.getElementById("movementQty").disabled = isTransfer;
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
    if (!bom || !Number.isInteger(qty) || qty < 1) { toast("Ingresá una cantidad entera mayor a cero.", "error"); return; }
    if (qty > availableUnits(bom)) { toast(`Stock insuficiente. La disponibilidad actual es de ${availableUnits(bom)} unidades.`, "error"); return; }
    for (const component of bom.components) {
      const product = state.products.find(item => item.id === component.productId);
      if (!product || product.stock < component.qty * qty) { toast(`No hay stock suficiente de ${product?.name || "un componente"}.`, "error"); return; }
    }
    bom.components.forEach(component => {
      const product = state.products.find(item => item.id === component.productId);
      const consumed = component.qty * qty;
      product.stock -= consumed;
      state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: product.id, productName: product.name, type: "salida", qty: consumed, user: currentUser().name, note: `Consumo para producción de ${bom.name}` });
    });
    bom.stock += qty;
    state.movements.unshift({ id: id("m"), date: new Date().toISOString(), productId: bom.productId, productName: bom.name, type: "produccion", qty, user: currentUser().name, note: `Producción registrada · ${qty} unidad${qty === 1 ? "" : "es"}` });
    audit("Producción registrada", `${qty} × ${bom.name}`);
    saveState(); render(); modalInstances.produceModal.hide(); toast(`Producción de ${qty} ${qty === 1 ? "unidad" : "unidades"} registrada.`);
  });
  document.getElementById("categoryForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!requirePermission("admin")) return;
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
  document.getElementById("userForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!requirePermission("admin")) return;
    const name = document.getElementById("userName").value.trim();
    if (state.users.some(user => user.active && user.name.toLowerCase() === name.toLowerCase())) { toast("Ya existe un usuario activo con ese nombre.", "error"); return; }
    const user = { id: id("u"), name, role: document.getElementById("userRole").value, createdAt: new Date().toISOString(), active: true };
    state.users.push(user); audit("Usuario creado", `${user.name} (${user.role})`); saveState(); render(); modalInstances.userModal.hide(); toast("Usuario agregado.");
  });
  document.getElementById("inventorySearch").addEventListener("input", renderInventory);
  document.getElementById("categoryFilter").addEventListener("change", renderInventory);
  document.getElementById("movementSearch").addEventListener("input", renderMovements);
  document.getElementById("movementTypeFilter").addEventListener("change", renderMovements);
  document.getElementById("clearFilters").addEventListener("click", () => {
    document.getElementById("inventorySearch").value = "";
    document.getElementById("categoryFilter").value = "";
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
  document.addEventListener("click", event => {
    const sidebar = document.getElementById("sidebar");
    if (window.innerWidth <= 900 && sidebar.classList.contains("open") && !sidebar.contains(event.target) && !event.target.closest("#mobileMenu")) sidebar.classList.remove("open");
  });
  window.addEventListener("storage", event => {
    if (event.key === STORE_KEY) { state = loadState(); render(); }
  });
  setViewTextDefaults();
  render();
})();
