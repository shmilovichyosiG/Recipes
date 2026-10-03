const ALL_CATEGORIES_LABEL = "-- הכל --";
const CHOOSE_RECIPE_LABEL = "-- בחר מתכון --";

let allRecipes = [];   // [{ index, name, category }]
let currentIndex = 0;  // מקביל ל- MainWindow.RecipeNumber

let history = [];       // רשימת האינדקסים של המתכונים שנבחרו, לפי סדר הבחירה
let historyPosition = -1; // המיקום הנוכחי בתוך history

/* ---------- השארת מסך הטלפון דולק ---------- */

let wakeLock = null;

async function keepScreenOn() {
    try {
        if ("wakeLock" in navigator) {
            // אם כבר קיים Wake Lock פעיל - אין צורך ליצור חדש
            if (wakeLock !== null && !wakeLock.released) {
                return;
            }

            wakeLock = await navigator.wakeLock.request("screen");

            console.log("Screen will stay on");

            wakeLock.addEventListener("release", () => {
                console.log("Screen wake lock released");
                wakeLock = null;
            });
        } else {
            console.log("Screen Wake Lock is not supported by this browser");
        }
    } catch (err) {
        console.log("Wake Lock could not be activated:", err);
    }
}

// כאשר חוזרים לאתר אחרי שהמסך היה ברקע,
// יש להפעיל מחדש את Wake Lock.
document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
        await keepScreenOn();
    }
});

// הפעלה ראשונית
keepScreenOn();

/* ---------- רכיבי HTML ---------- */

const els = {
    recipeCard: document.getElementById("recipeCard"),
    heroMedia: document.querySelector(".hero-media"),
    recipeName: document.getElementById("recipeName"),
    recipeCategory: document.getElementById("recipeCategory"),
    recipeImage: document.getElementById("recipeImage"),
    groceriesBox: document.getElementById("groceriesBox"),
    instructionsBox: document.getElementById("instructionsBox"),
    chooseBtn: document.getElementById("chooseBtn"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    recipeCounter: document.getElementById("recipeCounter"),
    modalOverlay: document.getElementById("modalOverlay"),
    categorySelect: document.getElementById("categorySelect"),
    recipeSelect: document.getElementById("recipeSelect"),
    selectBtn: document.getElementById("selectBtn"),
    cancelBtn: document.getElementById("cancelBtn"),
};

/* ---------- טעינת מתכון בודד למסך הראשי ---------- */

function loadRecipe(index) {
    const recipe = allRecipes.find((r) => r.index === index);

    if (!recipe) {
        els.recipeName.textContent = "שגיאה בטעינת המתכון";
        console.error("loadRecipe: recipe not found for index", index);
        return;
    }

    currentIndex = recipe.index;

    els.recipeCard.classList.remove("no-media");
    els.heroMedia.classList.remove("hidden");

    els.recipeName.textContent = recipe.name;
    els.recipeCategory.textContent = recipe.category || "מתכון";

    els.recipeImage.src = recipe.imageUrl;
    els.recipeImage.alt = recipe.name;

    renderGroceries(els.groceriesBox, recipe.groceries);
    renderInstructions(els.instructionsBox, recipe.instructions);
}

// מצב התחלתי - לפני שנבחר אף מתכון
function showEmptyState() {
    els.recipeCard.classList.add("no-media");
    els.heroMedia.classList.add("hidden");

    els.recipeName.textContent = "בחר מתכון כדי להתחיל";
    els.recipeCategory.textContent = "";

    els.recipeImage.removeAttribute("src");
    els.recipeImage.alt = "";

    els.groceriesBox.innerHTML = "";
    els.instructionsBox.innerHTML = "";

    els.recipeCounter.textContent = "";

    els.prevBtn.disabled = true;
    els.nextBtn.disabled = true;
}

// מעדכן את המונה ("2 מתוך 3") ואת מצב ה-disabled של חצי הניווט,
// לפי המיקום הנוכחי בתוך היסטוריית הבחירות
function updateNavUI() {
    els.recipeCounter.textContent =
        `${historyPosition + 1} מתוך ${history.length}`;

    els.prevBtn.disabled = historyPosition <= 0;
    els.nextBtn.disabled = historyPosition >= history.length - 1;
}

// מעבר בתוך ההיסטוריה הקיימת
// (כפתורי הבא/קודם) - לא מוסיף רשומה חדשה
async function goToHistory(newPosition) {
    if (newPosition < 0 || newPosition >= history.length) return;

    historyPosition = newPosition;

    await loadRecipe(history[historyPosition]);

    updateNavUI();
}

// בחירת מתכון מהמודאל - מוסיף רשומה חדשה בסוף ההיסטוריה.
// אם המתכון שנבחר כבר קיים איפשהו בהיסטוריה -
// לא נוצרת כפילות, אלא פשוט עוברים למיקום הקיים שלו.
//
// אם המשתמש בחר מתכון חדש לגמרי, "עתיד" ההיסטוריה
// (אם חזר אחורה קודם) נמחק.
async function selectRecipe(index) {
    const existingPosition = history.indexOf(index);

    if (existingPosition !== -1) {
        historyPosition = existingPosition;

        await loadRecipe(index);

        updateNavUI();

        return;
    }

    history = history.slice(0, historyPosition + 1);

    history.push(index);

    historyPosition = history.length - 1;

    await loadRecipe(index);

    updateNavUI();
}

els.prevBtn.addEventListener("click", () =>
    goToHistory(historyPosition - 1)
);

els.nextBtn.addEventListener("click", () =>
    goToHistory(historyPosition + 1)
);

/* ---------- הצגת מצרכים ---------- */

// כל שורה שמסתיימת ב-":" הופכת לכותרת-קבוצה.
// כל שורה רגילה מוצגת כפריט עם נקודה.
// שורות ריקות מדלגים עליהן.
function renderGroceries(container, lines) {
    container.innerHTML = "";

    lines.forEach(({ text, bold }) => {
        const trimmed = text.trim();

        if (trimmed === "") return;

        if (bold) {
            const header = document.createElement("div");

            header.className = "list-header";
            header.textContent = text;

            container.appendChild(header);

            return;
        }

        const row = document.createElement("div");

        row.className = "list-item";

        row.innerHTML =
            `<span class="dot"></span><span class="item-text"></span>`;

        row.querySelector(".item-text").textContent = text;

        container.appendChild(row);
    });
}

/* ---------- הצגת הוראות ---------- */

// שורות הוראות רגילות ממוספרות ברצף.
// המספור מתאפס בכל כותרת-קבוצה חדשה.
function renderInstructions(container, lines) {
    container.innerHTML = "";

    let stepNumber = 0;

    lines.forEach(({ text, bold }) => {
        const trimmed = text.trim();

        if (trimmed === "") return;

        if (bold) {
            const header = document.createElement("div");

            header.className = "list-header";
            header.textContent = text;

            container.appendChild(header);

            stepNumber = 0;

            return;
        }

        stepNumber += 1;

        const row = document.createElement("div");

        row.className = "step-item";

        row.innerHTML =
            `<span class="step-num"></span><span class="step-text"></span>`;

        row.querySelector(".step-num").textContent = stepNumber;
        row.querySelector(".step-text").textContent = text;

        container.appendChild(row);
    });
}

/* ---------- מודאל בחירת מתכון ---------- */

function openModal() {
    populateCategories();

    els.modalOverlay.classList.remove("hidden");

    // ניסיון נוסף להפעיל את Wake Lock
    // בעקבות פעולה של המשתמש.
    keepScreenOn();
}

function closeModal() {
    els.modalOverlay.classList.add("hidden");
}

function populateCategories() {
    const categories = [...new Set(allRecipes.map(r => r.category))]
        .filter(c => c)
        .sort((a, b) => a.localeCompare(b, "he"));

    categories.unshift(ALL_CATEGORIES_LABEL);

    els.categorySelect.innerHTML = "";

    categories.forEach(cat => {
        const opt = document.createElement("option");

        opt.value = cat;
        opt.textContent = cat;

        els.categorySelect.appendChild(opt);
    });

    els.categorySelect.selectedIndex = 0;

    populateRecipesForCategory(ALL_CATEGORIES_LABEL);
}

function populateRecipesForCategory(selectedCategory) {
    const names = new Set();

    allRecipes.forEach(r => {
        if (
            selectedCategory === ALL_CATEGORIES_LABEL ||
            r.category === selectedCategory
        ) {
            names.add(r.name);
        }
    });

    const sortedNames = [...names]
        .sort((a, b) => a.localeCompare(b, "he"));

    sortedNames.unshift(CHOOSE_RECIPE_LABEL);

    els.recipeSelect.innerHTML = "";

    sortedNames.forEach(name => {
        const opt = document.createElement("option");

        opt.value = name;
        opt.textContent = name;

        els.recipeSelect.appendChild(opt);
    });

    els.recipeSelect.selectedIndex = 0;

    els.selectBtn.disabled = true;
}

els.chooseBtn.addEventListener("click", openModal);

els.cancelBtn.addEventListener("click", closeModal);

els.modalOverlay.addEventListener("click", (e) => {
    if (e.target === els.modalOverlay) {
        closeModal();
    }
});

els.categorySelect.addEventListener("change", () => {
    populateRecipesForCategory(els.categorySelect.value);
});

els.recipeSelect.addEventListener("change", () => {
    els.selectBtn.disabled =
        els.recipeSelect.value === CHOOSE_RECIPE_LABEL;
});

els.selectBtn.addEventListener("click", async () => {
    const selectedName = els.recipeSelect.value;

    if (selectedName === CHOOSE_RECIPE_LABEL) return;

    const match = allRecipes.find(
        r => r.name === selectedName
    );

    if (!match) return;

    closeModal();

    // גם כאן, בעקבות לחיצה של המשתמש,
    // ננסה לוודא שהמסך נשאר דולק.
    await keepScreenOn();

    await selectRecipe(match.index);
});

/* ---------- אתחול ---------- */

async function init() {
    if (typeof RECIPES_DATA === "undefined") {
        els.recipeName.textContent =
            "לא נמצא recipes-data.js - יש להריץ build.bat קודם";

        return;
    }

    allRecipes = RECIPES_DATA;

    if (allRecipes.length === 0) {
        els.recipeName.textContent =
            "לא נמצאו מתכונים ב-data.xlsx";

        return;
    }

    // בטעינה ראשונית לא בוחרים מתכון ברירת מחדל.
    // פותחים ישר את הבחירה.
    showEmptyState();

    openModal();
}

init();