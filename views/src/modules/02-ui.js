function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
}

function showToast(message, type = "default") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.querySelector("#toast-region").appendChild(toast);
  window.setTimeout(() => toast.remove(), 5500);
}

async function request(url, options = {}) {
  const response = await fetch(appUrl(url), options);
  if (!response.ok) {
    let message = "Não foi possível concluir a operação.";
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

const userMenuTargets = [
  { area: userArea, button: userMenuButton, menu: userMenu },
].filter(target => target.area && target.button && target.menu);

function closeUserMenus() {
  userMenuTargets.forEach(({ button, menu }) => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });
}

userMenuTargets.forEach(({ button, menu }) => {
  button.addEventListener("click", event => {
    event.stopPropagation();
    const shouldOpen = menu.hidden;
    closeUserMenus();
    menu.hidden = !shouldOpen;
    button.setAttribute("aria-expanded", String(shouldOpen));
  });
});

document.addEventListener("click", event => {
  if (!userMenuTargets.some(({ area }) => area.contains(event.target))) {
    closeUserMenus();
  }
});

function userInitials(name, email) {
  const source = String(name || email || "Usuário").trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function setUserAvatar(element, user, name, email) {
  element.replaceChildren();
  const photoUrl = typeof user.foto_url === "string" ? user.foto_url.trim() : "";
  if (/^(https?:\/\/|\/)/i.test(photoUrl)) {
    const image = document.createElement("img");
    image.src = photoUrl;
    image.alt = "";
    image.addEventListener("error", () => {
      image.remove();
      element.textContent = userInitials(name, email);
    }, { once: true });
    element.appendChild(image);
    return;
  }
  element.textContent = userInitials(name, email);
}

function setUserText(selector, value, fallback = "—") {
  const element = document.querySelector(selector);
  if (element) element.textContent = value || fallback;
}

function setUserDetailRow(selector, value) {
  const row = document.querySelector(selector);
  if (row) row.hidden = !value;
}

function renderUser(user) {
  const email = String(user.email || "").trim();
  const name = String(user.nome || email || "Usuário").trim();
  const profile = String(user.perfil || "").trim();
  currentUserIsAdmin = profile.toLowerCase() === "admin";
  setAdminModulesVisibility(currentUserIsAdmin);
  const role = String(user.cargo || "").trim();
  const department = String(user.departamento || "").trim();
  const paNumber = String(user.numero_pa || "").trim();
  const paName = String(user.nome_pa || "").trim();
  const pa = [paNumber, paName].filter(Boolean).join(" · ");

  ["#user-avatar"].forEach(selector => {
    const avatar = document.querySelector(selector);
    if (avatar) setUserAvatar(avatar, user, name, email);
  });
  ["#user-name", "#user-menu-name"].forEach(selector => {
    setUserText(selector, name, "Usuário");
  });
  ["#user-email", "#user-menu-email"].forEach(selector => {
    setUserText(selector, email, "Sessão autenticada");
  });

  [
    ["#user-menu-profile", profile],
    ["#user-menu-role", role],
    ["#user-menu-department", department],
    ["#user-menu-pa", pa],
  ].forEach(([selector, value]) => {
    setUserText(selector, value);
  });
  [
    ["#user-menu-profile-row", profile],
    ["#user-menu-role-row", role],
    ["#user-menu-department-row", department],
    ["#user-menu-pa-row", pa],
  ].forEach(([selector, value]) => {
    setUserDetailRow(selector, value);
  });
}

async function loadCurrentUser() {
  try {
    const user = await request("/api/usuario");
    renderUser(user);
    return user;
  } catch {
    renderUser({ nome: "Usuário", email: "" });
    return null;
  }
}
