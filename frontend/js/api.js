"use strict";

const USER_KEY = "sc_user";
const USERS_KEY = "sc_demo_users";
const TOKEN_KEY = "sc_token";
const ORDERS_KEY = "sc_demo_orders";
const NEWSLETTER_KEY = "sc_demo_newsletter";

function textValue(value) {
  return String(value ?? "").trim();
}

function readStoredJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeUser(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    ...value,
    name: textValue(value.name),
    email: textValue(value.email).toLowerCase(),
    mobile: textValue(value.mobile)
  };
}

function getStoredUsers() {
  const storedUsers = readStoredJson(USERS_KEY, []);
  const users = (Array.isArray(storedUsers) ? storedUsers : [])
    .map(normalizeUser)
    .filter(Boolean);
  const currentUser = normalizeUser(readStoredJson(USER_KEY, null));
  if (currentUser && !users.some(user =>
    (currentUser.email && user.email === currentUser.email)
    || (currentUser.mobile && user.mobile === currentUser.mobile)
  )) {
    users.push(currentUser);
  }
  return users;
}

function saveAuth(user) {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser) throw new Error("User details are unavailable.");
  const users = getStoredUsers().filter(savedUser =>
    !(normalizedUser.email && savedUser.email === normalizedUser.email)
    && !(normalizedUser.mobile && savedUser.mobile === normalizedUser.mobile)
  );
  users.push(normalizedUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
  localStorage.setItem(TOKEN_KEY, "local-demo-session");
  return { user: normalizedUser, token: "local-demo-session" };
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getStoredUser() {
  return normalizeUser(readStoredJson(USER_KEY, null));
}

async function register(details = {}) {
  const user = {
    name: textValue(details?.name),
    mobile: textValue(details?.mobile),
    email: textValue(details?.email).toLowerCase(),
    address: textValue(details?.address),
    city: textValue(details?.city),
    pincode: textValue(details?.pincode),
    state: textValue(details?.state)
  };
  if (!user.email && !user.mobile) throw new Error("Enter an email address or mobile number to register.");
  return saveAuth(user);
}

async function login(credentials = {}) {
  const identity = textValue(credentials?.identity).toLowerCase();
  const user = identity && getStoredUsers().find(savedUser =>
    [savedUser.email, savedUser.mobile]
      .some(value => value && value.toLowerCase() === identity)
  );
  if (!user) throw new Error("User not found. Register in this browser first.");
  return saveAuth(user);
}

async function placeOrder(order) {
  const orderItems = Array.isArray(order?.items) ? order.items : [];
  if (!orderItems.length) throw new Error("Your basket is empty.");
  const items = orderItems.map(item => {
    if (!item || typeof item !== "object") throw new Error("An order item is invalid.");
    const product = LOCAL_PRODUCTS.find(candidate => candidate.id === String(item.product_id));
    if (!product) throw new Error("A product in this order is no longer available.");
    const unitPrice = Number(product.prices[textValue(item.size)]);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error("A product pack is invalid.");
    const quantity = Number(item.qty);
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("An order quantity is invalid.");
    return {
      product_id: product.id,
      name: product.name,
      size: textValue(item.size),
      qty: quantity,
      unit_price: unitPrice,
      line_total: unitPrice * quantity
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
  const orderRecord = {
    order_code: `SC${Date.now().toString().slice(-8)}`,
    items,
    shipping: order?.shipping && typeof order.shipping === "object" ? order.shipping : {},
    subtotal,
    delivery_fee: subtotal >= 999 ? 0 : 60,
    total: subtotal + (subtotal >= 999 ? 0 : 60),
    payment_method: textValue(order.payment_method) || "COD",
    status: "Placed",
    created_at: new Date().toISOString()
  };
  const orders = await getMyOrders();
  orders.unshift(orderRecord);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  return orderRecord;
}

async function getMyOrders() {
  const orders = readStoredJson(ORDERS_KEY, []);
  return Array.isArray(orders) ? orders.filter(order => order && typeof order === "object") : [];
}

async function cancelOrder(orderCode) {
  const orders = await getMyOrders();
  const order = orders.find(item => item.order_code === orderCode);
  if (!order || !["Placed", "Packed"].includes(order.status)) {
    throw new Error("This local demo order can no longer be cancelled.");
  }
  order.status = "Cancelled";
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  return order;
}

async function updateOrderStatus(orderCode, status) {
  const orders = await getMyOrders();
  const order = orders.find(item => item.order_code === orderCode);
  if (!order) throw new Error("Order not found in this browser.");
  order.status = status;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  return order;
}

async function subscribeNewsletter(email) {
  const storedSubscriptions = readStoredJson(NEWSLETTER_KEY, []);
  const subscriptions = Array.isArray(storedSubscriptions) ? storedSubscriptions.filter(value => typeof value === "string") : [];
  const normalizedEmail = textValue(email).toLowerCase();
  if (!subscriptions.includes(normalizedEmail)) subscriptions.push(normalizedEmail);
  localStorage.setItem(NEWSLETTER_KEY, JSON.stringify(subscriptions));
  return { subscribed: true };
}
