
"use strict";

const API = "https://www.themealdb.com/api/json/v1/1";
const $ = selector => document.querySelector(selector);

const state = {
  meals: [],
  filtered: [],
  categories: [],
  category: "all",
  search: "",
  sort: "default",
  limit: 8,
  cart: readStorage("ember-cart"),
  wishlist: readStorage("ember-wishlist")
};

function readStorage(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem("ember-cart", JSON.stringify(state.cart));
    localStorage.setItem("ember-wishlist", JSON.stringify(state.wishlist));
  } catch (error) {
    console.warn("Browser storage unavailable", error);
  }
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function imageURL(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function money(value) {
  return "Rs. " + Math.round(value).toLocaleString("en-PK");
}

function toast(message) {
  $("#toastText").textContent = message;
  bootstrap.Toast.getOrCreateInstance($("#appToast"), {
    delay: 3000
  }).show();
}

async function request(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}

/* LOAD MENU API */

async function loadMenu() {
  $("#mealStatus").className = "status";
  $("#mealStatus").textContent = "Discovering delicious recipes...";
  $("#mealGrid").replaceChildren();
  $("#loadMore").classList.add("d-none");

  try {
    const result = await request(API + "/search.php?s=");
    state.meals = result.meals || [];

    if (!state.meals.length) {
      const fallback = await request(API + "/search.php?f=a");
      state.meals = fallback.meals || [];
    }

    state.meals = state.meals.map(meal => ({
      ...meal,
      strMealThumb: imageURL(meal.strMealThumb)
    }));

    await loadCategories();
    filterMenu();
  } catch (error) {
    console.error(error);

    $("#mealStatus").className = "status status-error";
    $("#mealStatus").textContent =
      "Could not load the menu. Check your internet connection.";

    const retry = document.createElement("button");
    retry.id = "retry";
    retry.className = "btn btn-copper ms-2";
    retry.textContent = "Retry";
    retry.addEventListener("click", loadMenu);

    $("#mealStatus").append(" ", retry);
  }
}

async function loadCategories() {
  try {
    const data = await request(API + "/categories.php");
    state.categories = data.categories || [];
  } catch (error) {
    console.warn("Category API unavailable", error);
    state.categories = [];
  }

  renderCategories();
}

function renderCategories() {
  const container = $("#categoryList");
  container.replaceChildren();

  const categories = [
    { strCategory: "all" },
    ...state.categories
  ];

  categories.forEach(category => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "category-chip";
    button.dataset.category = category.strCategory;
    button.textContent =
      category.strCategory === "all"
        ? "All Dishes"
        : category.strCategory;

    container.appendChild(button);
  });

  updateCategoryButtons();
}

function updateCategoryButtons() {
  document.querySelectorAll(".category-chip").forEach(button => {
    const active = button.dataset.category === state.category;

    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

/* SEARCH, CATEGORY AND SORT */

function filterMenu() {
  const term = state.search.toLowerCase();

  state.filtered = state.meals.filter(meal => {
    const name = (meal.strMeal || "").toLowerCase();
    const area = (meal.strArea || "").toLowerCase();
    const category = (meal.strCategory || "").toLowerCase();

    const matchesSearch =
      name.includes(term) ||
      area.includes(term) ||
      category.includes(term);

    const matchesCategory =
      state.category === "all" ||
      meal.strCategory === state.category;

    return matchesSearch && matchesCategory;
  });

  if (state.sort === "az") {
    state.filtered.sort((a, b) =>
      a.strMeal.localeCompare(b.strMeal)
    );
  }

  if (state.sort === "za") {
    state.filtered.sort((a, b) =>
      b.strMeal.localeCompare(a.strMeal)
    );
  }

  state.limit = 8;
  renderMenu();
  updateCategoryButtons();
}

/* RENDER FOOD CARDS */

function renderMenu() {
  const grid = $("#mealGrid");
  grid.replaceChildren();

  $("#resultCount").textContent =
    state.filtered.length + " dishes";

  $("#mealStatus").textContent = state.filtered.length
    ? "A collection of flavours to explore."
    : "No dishes found. Try a different search or category.";

  const fragment = document.createDocumentFragment();

  state.filtered.slice(0, state.limit).forEach(meal => {
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-lg-4 col-xl-3";

    const saved = state.wishlist.some(
      item => item.idMeal === meal.idMeal
    );

    const img = meal.strMealThumb ||
      "https://placehold.co/600x400?text=Ember+%26+Spice";

    col.innerHTML = `
      <article class="meal-card">
        <div class="meal-image-wrap">
          <img
            class="meal-image"
            src="${esc(img)}"
            alt="${esc(meal.strMeal)}"
            loading="lazy"
          >
          <button
            class="wish-btn"
            type="button"
            data-action="wish"
            data-id="${esc(meal.idMeal)}"
            aria-label="${saved ? "Remove from" : "Add to"} wishlist"
          >
            <i class="bi ${saved ? "bi-heart-fill" : "bi-heart"}"></i>
          </button>
        </div>

        <div class="meal-card-body">
          <span class="meal-category">
            ${esc(meal.strCategory || meal.strArea || "Recipe")}
          </span>

          <h3>${esc(meal.strMeal)}</h3>

          <div class="meal-card-actions">
            <button
              type="button"
              class="btn btn-outline-copper"
              data-action="recipe"
              data-id="${esc(meal.idMeal)}"
            >
              View Recipe
            </button>

            <button
              type="button"
              class="btn btn-dark-custom"
              data-action="cart"
              data-id="${esc(meal.idMeal)}"
              aria-label="Add to cart"
            >
              <i class="bi bi-bag-plus"></i>
            </button>
          </div>
        </div>
      </article>
    `;

    const image = col.querySelector("img");

    image.addEventListener("error", () => {
      image.src = "https://placehold.co/600x400?text=Food";
    }, { once: true });

    fragment.appendChild(col);
  });

  grid.appendChild(fragment);

  $("#loadMore").classList.toggle(
    "d-none",
    state.limit >= state.filtered.length
  );
}

function getMeal(id) {
  return state.meals.find(meal => meal.idMeal === id) ||
    state.wishlist.find(meal => meal.idMeal === id);
}

/* CART */

function addCart(id) {
  const meal = getMeal(id);
  if (!meal) return;

  const existing = state.cart.find(
    item => item.idMeal === id
  );

  if (existing) {
    existing.quantity++;
  } else {
    state.cart.push({
      idMeal: meal.idMeal,
      strMeal: meal.strMeal,
      strMealThumb: meal.strMealThumb,
      quantity: 1,
      price: 850
    });
  }

  persist();
  renderCart();
  toast("Added to your cart!");
}

function changeQuantity(id, delta) {
  const item = state.cart.find(
    entry => entry.idMeal === id
  );

  if (!item) return;

  item.quantity += delta;

  if (item.quantity <= 0) {
    state.cart = state.cart.filter(
      entry => entry.idMeal !== id
    );
  }

  persist();
  renderCart();
}

function renderCart() {
  const container = $("#cartItems");
  container.replaceChildren();

  let count = 0;
  let total = 0;

  state.cart.forEach(item => {
    count += item.quantity;
    total += item.price * item.quantity;

    const row = document.createElement("div");
    row.className = "cart-line";

    row.innerHTML = `
      <img
        src="${esc(item.strMealThumb || "https://placehold.co/100?text=Food")}"
        alt=""
      >

      <div class="cart-info">
        <strong>${esc(item.strMeal)}</strong>
        <small>${money(item.price)} / sample item</small>

        <div class="qty-controls">
          <button
            type="button"
            data-qty="minus"
            data-id="${esc(item.idMeal)}"
            aria-label="Decrease quantity"
          >−</button>

          <span>${item.quantity}</span>

          <button
            type="button"
            data-qty="plus"
            data-id="${esc(item.idMeal)}"
            aria-label="Increase quantity"
          >+</button>

          <button
            type="button"
            class="btn btn-sm btn-outline-danger"
            data-qty="remove"
            data-id="${esc(item.idMeal)}"
          >Remove</button>
        </div>
      </div>
    `;

    container.appendChild(row);
  });

  if (!state.cart.length) {
    container.textContent =
      "Your cart is empty. Explore our menu to discover something delicious.";
  }

  $("#cartCount").textContent = count;
  $("#cartTotal").textContent = money(total);
}

/* WISHLIST */

function toggleWish(id) {
  const meal = getMeal(id);
  if (!meal) return;

  const exists = state.wishlist.some(
    item => item.idMeal === id
  );

  if (exists) {
    state.wishlist = state.wishlist.filter(
      item => item.idMeal !== id
    );
    toast("Removed from your favourites.");
  } else {
    state.wishlist.push({
      idMeal: meal.idMeal,
      strMeal: meal.strMeal,
      strMealThumb: meal.strMealThumb,
      strCategory: meal.strCategory,
      strArea: meal.strArea
    });

    toast("Saved to your favourites!");
  }

  persist();
  renderWishlist();
  renderMenu();
}

function renderWishlist() {
  const container = $("#wishlistItems");
  container.replaceChildren();

  $("#wishCount").textContent = state.wishlist.length;

  if (!state.wishlist.length) {
    container.textContent =
      "Your favourites collection is empty. Save a dish you love!";
    return;
  }

  state.wishlist.forEach(meal => {
    const row = document.createElement("div");
    row.className = "wish-line";

    row.innerHTML = `
      <img
        src="${esc(meal.strMealThumb || "https://placehold.co/100?text=Food")}"
        alt=""
      >

      <div class="wish-info">
        <strong>${esc(meal.strMeal)}</strong>

        <button
          type="button"
          class="btn btn-sm btn-copper mt-2"
          data-wish="cart"
          data-id="${esc(meal.idMeal)}"
        >Add to Cart</button>

        <button
          type="button"
          class="btn btn-sm btn-outline-secondary mt-2"
          data-wish="remove"
          data-id="${esc(meal.idMeal)}"
        >Remove</button>
      </div>
    `;

    container.appendChild(row);
  });
}

/* RECIPE DETAILS API */

async function showRecipe(id) {
  const modal = bootstrap.Modal.getOrCreateInstance(
    $("#recipeModal")
  );

  const content = $("#recipeContent");

  $("#recipeHeading").textContent = "Recipe Details";
  content.textContent = "Loading recipe details...";
  modal.show();

  try {
    const data = await request(
      API + "/lookup.php?i=" + encodeURIComponent(id)
    );

    const meal = data.meals?.[0];

    if (!meal) throw new Error("Recipe not found");

    $("#recipeHeading").textContent =
      meal.strMeal || "Recipe Details";

    const ingredients = [];

    for (let i = 1; i <= 20; i++) {
      const name = meal["strIngredient" + i];
      const measure = meal["strMeasure" + i];

      if (name && name.trim()) {
        ingredients.push(
          `<li>${esc(name)} — ${esc(measure || "")}</li>`
        );
      }
    }

    let videoURL = "";

    try {
      const url = new URL(meal.strYoutube || "");

      if ([
        "youtube.com",
        "www.youtube.com",
        "youtu.be",
        "www.youtu.be"
      ].includes(url.hostname)) {
        videoURL = url.href;
      }
    } catch {
      videoURL = "";
    }

    content.innerHTML = `
      <img
        class="recipe-image mb-4"
        src="${esc(imageURL(meal.strMealThumb))}"
        alt="${esc(meal.strMeal)}"
      >

      <p><strong>Category:</strong> ${esc(meal.strCategory || "Not specified")}</p>
      <p><strong>Cuisine:</strong> ${esc(meal.strArea || "Not specified")}</p>

      <h3 class="fs-5 mt-4">Ingredients</h3>
      <ul>
        ${ingredients.length
          ? ingredients.join("")
          : "<li>Ingredients unavailable.</li>"}
      </ul>

      <h3 class="fs-5 mt-4">Cooking Instructions</h3>
      <p class="recipe-instructions">
        ${esc(meal.strInstructions || "Instructions unavailable.")}
      </p>

      ${videoURL ? `
        <a
          class="btn btn-copper mt-2"
          href="${esc(videoURL)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Watch Recipe <i class="bi bi-youtube ms-1"></i>
        </a>
      ` : ""}

      <button
        type="button"
        class="btn btn-dark-custom mt-2 ms-1"
        id="recipeAddCart"
        data-id="${esc(meal.idMeal)}"
      >Add to Cart</button>
    `;

    $("#recipeAddCart").addEventListener("click", () => {
      addCart(meal.idMeal);
    });
  } catch (error) {
    console.error(error);

    content.textContent =
      "Sorry, this recipe could not be loaded. Check your internet connection and try again.";
  }
}

/* OPEN PANELS */

function openPanel(selector) {
  bootstrap.Offcanvas.getOrCreateInstance(
    $(selector)
  ).show();
}

/* DATE HELPER */

function getLocalDate() {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

/* CONNECT ALL BUTTONS AND FORMS */

function init() {
  $("#categoryList").addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    state.category = button.dataset.category;
    filterMenu();
  });

  $("#mealSearch").addEventListener("input", event => {
    state.search = event.target.value.trim();
    filterMenu();
  });

  $("#sortMeals").addEventListener("change", event => {
    state.sort = event.target.value;
    filterMenu();
  });

  $("#loadMore").addEventListener("click", () => {
    state.limit += 8;
    renderMenu();
  });

  $("#mealGrid").addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const { action, id } = button.dataset;

    if (action === "cart") addCart(id);
    if (action === "wish") toggleWish(id);
    if (action === "recipe") showRecipe(id);
  });

  $("#cartItems").addEventListener("click", event => {
    const button = event.target.closest("[data-qty]");
    if (!button) return;

    const { id, qty } = button.dataset;

    if (qty === "plus") changeQuantity(id, 1);
    if (qty === "minus") changeQuantity(id, -1);

    if (qty === "remove") {
      state.cart = state.cart.filter(
        item => item.idMeal !== id
      );

      persist();
      renderCart();
    }
  });

  $("#wishlistItems").addEventListener("click", event => {
    const button = event.target.closest("[data-wish]");
    if (!button) return;

    if (button.dataset.wish === "cart") {
      addCart(button.dataset.id);
    }

    if (button.dataset.wish === "remove") {
      toggleWish(button.dataset.id);
    }
  });

  $("#openCart").addEventListener("click", () => {
    renderCart();
    openPanel("#cartPanel");
  });

  $("#openWishlist").addEventListener("click", () => {
    renderWishlist();
    openPanel("#wishlistPanel");
  });

  $("#footerCart").addEventListener("click", () => {
    renderCart();
    openPanel("#cartPanel");
  });

  $("#footerWishlist").addEventListener("click", () => {
    renderWishlist();
    openPanel("#wishlistPanel");
  });

  $("#clearCart").addEventListener("click", () => {
    state.cart = [];
    persist();
    renderCart();
    toast("Your cart has been cleared.");
  });

  $("#checkoutBtn").addEventListener("click", () => {
    toast(state.cart.length
      ? "Demo only: no real order or payment was submitted."
      : "Your cart is empty.");
  });

  $("#reservationForm").addEventListener("submit", event => {
    event.preventDefault();

    if (!event.currentTarget.reportValidity()) return;

    if ($("#resDate").value < getLocalDate()) {
      toast("Please choose today or a future date.");
      return;
    }

    toast(
      "Enquiry demo submitted. No real reservation was made."
    );

    event.currentTarget.reset();
    $("#resDate").min = getLocalDate();
  });

  $("#newsletterForm").addEventListener("submit", event => {
    event.preventDefault();

    if (!event.currentTarget.reportValidity()) return;

    toast("Demo complete. No email was sent to a server.");
    event.currentTarget.reset();
  });

  $("#resDate").min = getLocalDate();
  $("#currentYear").textContent = new Date().getFullYear();

  $("#backTop").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", () => {
    $("#backTop").classList.toggle(
      "visible",
      window.scrollY > 350
    );
  }, { passive: true });

  document.querySelectorAll("#mainNav .nav-link").forEach(link => {
    link.addEventListener("click", () => {
      const nav = $("#mainNav");

      if (nav.classList.contains("show")) {
        bootstrap.Collapse.getOrCreateInstance(nav).hide();
      }
    });
  });

  renderCart();
  renderWishlist();
  loadMenu();
}

init();
