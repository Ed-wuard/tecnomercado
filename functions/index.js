const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();

exports.deleteManagedUser = onCall(async request => {
  const requesterUid = request.auth?.uid;
  if (!requesterUid) {
    throw new HttpsError("unauthenticated", "Iniciá sesión como Administrador para eliminar usuarios.");
  }

  const targetUid = request.data?.uid;
  if (typeof targetUid !== "string" || !targetUid || targetUid.length > 128 || targetUid.includes("/")) {
    throw new HttpsError("invalid-argument", "El perfil seleccionado no es válido.");
  }
  if (targetUid === requesterUid) {
    throw new HttpsError("failed-precondition", "No podés eliminar tu propia cuenta.");
  }

  const db = getFirestore();
  const requesterSnapshot = await db.collection("users").doc(requesterUid).get();
  const requester = requesterSnapshot.data();
  if (!requesterSnapshot.exists || requester?.active !== true || requester.role !== "Administrador") {
    throw new HttpsError("permission-denied", "Solo un Administrador activo puede eliminar usuarios.");
  }

  const targetRef = db.collection("users").doc(targetUid);
  const targetSnapshot = await targetRef.get();
  const target = targetSnapshot.data();
  if (!targetSnapshot.exists) {
    throw new HttpsError("not-found", "No se encontró el perfil seleccionado.");
  }
  if (target.role === "Administrador") {
    throw new HttpsError("failed-precondition", "No se puede eliminar el perfil Administrador.");
  }

  try {
    await getAuth().deleteUser(targetUid);
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw new HttpsError("internal", `No se pudo eliminar la cuenta de acceso: ${error.message}`);
    }
  }

  const email = target.email || target.username || "sin correo";
  const auditRef = db.collection("auditLogs").doc();
  const batch = db.batch();
  batch.delete(targetRef);
  batch.set(auditRef, {
    id: auditRef.id,
    date: new Date().toISOString(),
    user: requester.name || "Administrador",
    action: "Usuario eliminado",
    detail: `${target.name || email} (${email})`
  });
  try {
    await batch.commit();
  } catch (error) {
    throw new HttpsError("internal", `La cuenta de acceso ya fue eliminada, pero no se pudo completar la limpieza del perfil. Volvé a intentar la eliminación para finalizarla. ${error.message}`);
  }

  return { uid: targetUid, email };
});
