const IS_MOBILE_OR_TABLET = window.matchMedia("(max-width: 1024px)").matches;
const WIDTH = 5000;
const HEIGHT = window.innerHeight;
const IMG_BASE_URL = "https://raw.githubusercontent.com/react117/cn-fam-tree/master/assets/images/src/";
const NODE_RADIUS = 32;
const INITIAL_TRANSLATE_X = IS_MOBILE_OR_TABLET ? WIDTH / 10 : WIDTH / 4;
const INITIAL_TRANSLATE_Y = 50;
const TREE_DEFAULT_SCALE = 0.8;
const CARD_WIDTH = 120;
const CARD_HEIGHT = 160;
let searchIndex = null;
let treeRoot = null;
let peopleById = new Map();

const svg = d3.select("#tree-container")
    .append("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .style("touch-action", "none");

const treeGroup = svg.append("g")
    .attr("class", "tree-container");

// zoom behavior
const zoom = d3.zoom()
    .scaleExtent([0.3, 5]) // min zoom, max zoom
    .filter(event => {
        // Always allow programmatic zoom (search centering)
        if (!event.sourceEvent) return true;

        const sourceType = event.sourceEvent.type;

        // Touch gestures (mobile)
        if (sourceType && sourceType.startsWith("touch")) return true;

        // Mouse wheel (desktop)
        if (event.type === "wheel") return true;

        // Mouse drag only on empty space (not on nodes)
        return !event.target.closest(".node");
    })
    .on("zoom", (event) => {
        treeGroup.attr("transform", event.transform);
    });

svg.call(
  zoom.transform,
  d3.zoomIdentity
    .translate(INITIAL_TRANSLATE_X, 100)
    .scale(TREE_DEFAULT_SCALE)
);

const initialTransform = d3.zoomIdentity
  .translate(INITIAL_TRANSLATE_X, INITIAL_TRANSLATE_Y)
  .scale(TREE_DEFAULT_SCALE);

// Set initial position [Solves the jump/jerk on 1st zoom/pan]
svg.call(zoom);
svg.call(zoom.transform, initialTransform);
// --

d3.csv("data/family.csv").then(data => {
    data.forEach(d => {
        d.YearOfBirth = +d.YearOfBirth || null;
        d.YearOfDeath = +d.YearOfDeath || null;
        d.YearOfMarriage = +d.YearOfMarriage || null;
        d.Image = IMG_BASE_URL + d.Name.replace(/\s/g, "") + ".jpg";
    });

    // Create a lightweight in-memory index
    searchIndex = data.map(person => ({
        id: person.ID,
        name: (person.Name || "").toLowerCase(),
        nickname: (person.Nickname || "").toLowerCase(),
        image: person.Image,
        raw: person
    }));

    console.log(data);

    buildTree(data);
});

/** 
 * Build parent-child relation using IDs
 * 
 * Map every person by ID
 * Attach children to parents
 * Pick a root ancestor
*/
function buildTree(data) {
    peopleById.clear();
    const familyByKey = new Map();

    // Initialize people
    data.forEach(person => {
        person.children = [];
        person._marriages = [];
        peopleById.set(person.ID, person);
    });

    // Helper to generate family key
    function familyKey(p1, p2) {
        return [p1, p2].sort().join("_");
    }

    // Create family nodes and attach children
    data.forEach(child => {
        if (!child.FatherID || !child.MotherID) return;

        const father = peopleById.get(child.FatherID);
        const mother = peopleById.get(child.MotherID);

        if (!father || !mother) return;

        const key = familyKey(father.ID, mother.ID);

        let familyNode;

        if (!familyByKey.has(key)) {
            familyNode = {
                ID: `FAM_${key}`,
                type: "marriage",
                partners: [father, mother],
                children: []
            };

            familyByKey.set(key, familyNode);

            father._marriages.push(familyNode);
            mother._marriages.push(familyNode);

            // mark spouse persons once
            father._isSpouse = true;
            mother._isSpouse = true;
        } else {
            familyNode = familyByKey.get(key);
        }

        familyNode.children.push(child);
    });

    // Create family nodes for married couples with no children
    data.forEach(person => {
        if (!person.MarriedToID) return;

        const spouse = peopleById.get(person.MarriedToID);
        if (!spouse) return;

        const key = familyKey(person.ID, spouse.ID);

        if (!familyByKey.has(key)) {
            const familyNode = {
                ID: `FAM_${key}`,
                type: "marriage",
                partners: [person, spouse],
                children: []
            };

            familyByKey.set(key, familyNode);

            person._marriages.push(familyNode);
            spouse._marriages.push(familyNode);

            person._isSpouse = true;
            spouse._isSpouse = true;
        }
    });

    // Pick root ancestor (person with no parents)
    const rootPerson = data.find(
        p => !p.FatherID && !p.MotherID
    );

    const root = buildHierarchy(rootPerson);

    renderTree(root);
}

/**
 * Convert graph → tree
 * 
 * this function creates a valid tree:
 * Person (descendant)
 *  └── MarriageLink
 *       ├── Spouse (rendered next to descendant)
 *       └── Child
 * 
 * The virtual family node: 
 * - Do not exist in CSV
 * - Are created in JS
 * - Represent a married couple
 * - Act as the only parent of children
 * 
 * @param {*} person 
 * @returns each person as a node introducing _marriages
 * 
 * @array person._marriages def
 * If: FatherID = P001 && MotherID = P002
 * We create: _marriages with ID: FAM_P001_P002
 * 
 * A family node has exactly 2 parents
 * A child always attaches to a family node, not any single parent
 * A person can have multiple family nodes (remarriage later)
 * D3 still sees a tree, not a graph
 */
function buildHierarchy(person) {
    const node = {
        ...person,
        children: []
    };

    if (person._marriages) {
        person._marriages.forEach(marriage => {
            const marriageNode = {
                ID: marriage.ID,
                type: "marriage",
                partners: marriage.partners,
                children: marriage.children.map(child =>
                    buildHierarchy(child)
                )
            };

            node.children.push(marriageNode);
        });
    }

    return node;
}

// Render the tree with D3
function renderTree(rootData) {
    // add SVG clip-path
    // creates a reusable circular mask.
    const defs = treeGroup.append("defs");

    defs.append("clipPath")
        .attr("id", "node-circle-clip")
        .append("circle")
        .attr("r", NODE_RADIUS)
        .attr("cx", 0)
        .attr("cy", 0);

    const root = treeRoot = d3.hierarchy(rootData);

    const treeLayout = d3.tree()
        .nodeSize([180, 200]); // [horizontal spacing (siblings / cousins), vertical spacing (generations)]

    treeLayout(root);

    // Links
    treeGroup.selectAll(".link")
        .data(root.links())
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", d3.linkVertical()
            .x(d => d.x)
            .y(d => d.y)
        );

    // Nodes
    // Family nodes (the virtual nodes) are small gray dots
    // Person nodes are normal circles
    // Family nodes have no label
    const node = treeGroup.selectAll(".node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", d =>
            d.data.type === "marriage" ? "node family-node" : "node person-node"
        )
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .attr("data-person-id", d => d.data.ID);
    // ------

    // person card default padding
    const FO_PADDING = 30;

    // render family nodes | married | have children
    node.filter(d => d.data.type === "marriage")
    .each(function (d) {
        const familyGroup = d3.select(this);
        const spouses = d.data.type === "marriage" ? d.data.partners : [];

        const spouseOffset = 80;

        spouses.forEach((person, index) => {
            const xOffset =
            spouses.length === 1 ? 0 :
            index === 0 ? -spouseOffset : spouseOffset;

            const personGroup = familyGroup.append("g")
                .attr("class", "spouse-node")
                .attr("transform", `translate(${xOffset}, -50)`)
                .attr("data-person-id", person.ID);

            personGroup
                .append("foreignObject")
                .attr("x", -(CARD_WIDTH / 2) - FO_PADDING)
                .attr("y", -(CARD_HEIGHT / 2) - FO_PADDING)
                .attr("width", CARD_WIDTH + FO_PADDING * 2)
                .attr("height", CARD_HEIGHT + FO_PADDING * 2)
                .append("xhtml:div")
                .attr("class", "person-card-wrapper spouse-card")
                .html(d => renderPersonCardHTML(person))
                .on("click", (event) => {
                    event.stopPropagation();
                    
                    // Open bottom sheet
                    const html = renderPersonBottomSheetHTML(person);
                    openBottomSheet(html);
                });
        });
    });
    // ------

    // render single people nodes | not married | no children
    node
        .filter(d => d.data.type !== "marriage" && !d.data._isSpouse)
        .append("foreignObject")
        .attr("x", -(CARD_WIDTH / 2) - FO_PADDING)
        .attr("y", -(CARD_HEIGHT / 2) - FO_PADDING)
        .attr("width", CARD_WIDTH + FO_PADDING * 2)
        .attr("height", CARD_HEIGHT + FO_PADDING * 2)
        .append("xhtml:div")
        .attr("class", "person-card-wrapper")
        .html(d => renderPersonCardHTML(d.data))
        .on("click", (event, d) => {
            event.stopPropagation();

            // Open bottom sheet
            const html = renderPersonBottomSheetHTML(d.data);
            openBottomSheet(html);
        });
}

/**
 * Helper function to construct person cards
 * @param {*} d node/person data
 * @returns person card html
 */
function renderPersonCardHTML(personData) {
    let yob = personData.YearOfBirth;
    let yod = personData.YearOfDeath;

    let lifeText = "";
    if (yob && !yod) {
        const age = new Date().getFullYear() - yob;
        lifeText = `${yob} · ${age} years`;
    } else if (!yob && !yod) {
        lifeText = `Unknown`;
    } else {
        yob = (!yob) ? `Unknown` : yob;
        yod = (!yod) ? `Unknown` : yod;

        lifeText = `${yob} – ${yod}`;
    }

    return `
        <div class="person-card">
            <div class="card-image">
                <img src="${personData.Image}"
                    onerror="this.onerror=null;this.src='${IMG_BASE_URL}def${personData.Gender}.jpg';" />
            </div>
            <div class="card-name">${personData.Name}</div>
            ${lifeText ? `<div class="card-meta">${lifeText}</div>
        </div>` : ""}
    `;
}

/**
 * Helper function to construct bottom sheet data
 * @param {*} d 
 * @returns bottom sheet html
 */
function renderPersonBottomSheetHTML(personData) {
    let bottomSHeetDataHtml = "";

    bottomSHeetDataHtml +=    `<div class="person-sheet">`;
    bottomSHeetDataHtml +=        `<div class="person-sheet-photo">`;
    bottomSHeetDataHtml +=            `<img src="${personData.Image}" onerror="this.onerror=null;this.src='${IMG_BASE_URL}def${personData.Gender}.jpg';" alt="${personData.Name}" />`;
    bottomSHeetDataHtml +=        `</div>`;
    bottomSHeetDataHtml +=        `<div class="person-sheet-details">`;
    
    if(personData.Name)
        bottomSHeetDataHtml +=            `<div class="person-name">${personData.Name}</div>`;

    if(personData.Nickname)
        bottomSHeetDataHtml +=            `<div class="person-nick-name">${personData.Nickname}</div>`;

    if(personData.Profession)
        bottomSHeetDataHtml +=            `<div class="person-nick-name">${personData.Profession}</div>`;

    bottomSHeetDataHtml +=            `${renderLifeLine(personData)}`;
    bottomSHeetDataHtml +=            `${renderParentSection(personData)}`;
    bottomSHeetDataHtml +=            `${renderMarriageSection(personData)}`;
    bottomSHeetDataHtml +=            `${renderChildrenSection(personData)}`;
    bottomSHeetDataHtml +=            `${renderNotesSection(personData)}`;
    bottomSHeetDataHtml +=        `</div>`;
    bottomSHeetDataHtml +=    `</div>`;

    return bottomSHeetDataHtml;
}

/**
 * Helper to render birth/death data on bottom sheet
 * @param {*} personData 
 * @returns life line html
 */
function renderLifeLine(personData) {
    let yob = personData.YearOfBirth;
    let yod = personData.YearOfDeath;

    // No data -> render nothing
    if (!yob && !yod) return "";

    let lifeText = "";
    if (yob && !yod) {
        const age = new Date().getFullYear() - yob;
        lifeText = `${yob} · ${age} years`;
    } else {
        yob = (!yob) ? `Unknown` : yob;
        yod = (!yod) ? `Unknown` : yod;

        lifeText = `${yob} – ${yod}`;
    }

    return `<div class="life-line">${lifeText}</div>`;
}

/**
 * Helper to render parent data on bottom sheet
 * @param {*} personData 
 * @returns parent html
 */
function renderParentSection(personData) {
    // Guard: only biological persons can have parents
    if (!personData || (!personData.FatherID && !personData.MotherID)) {
        return "";
    }

    const parents = getParentsForPerson(personData);
    if (!parents.length) return "";

    let label = "";
    if (personData.Gender === "Male") label = "Responsible Son of";
    if (personData.Gender === "Female") label = "Responsible Daughter of";

    const parentNames = parents
        .map(p => p.Name?.split(" ")[0])
        .filter(Boolean)
        .join(" and ");

    if (!parentNames) return "";

    return `
        <section class="person-parents">
            <div class="relation-block">
                <div class="relation-icon">🌳</div>
                <div class="relation-content">
                    <div class="relation-text">${label}</div>
                    <div class="relation-value">${parentNames}</div>
                </div>
            </div>
        </section>
    `;
}

/**
 * Helper to render marriage/spouse data on bottom sheet
 * @param {*} personData 
 * @returns marriage html
 */
function renderMarriageSection(personData) {
    if (!personData || !Array.isArray(personData._marriages) || !personData._marriages.length) {
        return "";
    }

    // marriage text
    let relationLabel = "";
    if (personData.Gender === "Male") relationLabel = "Loving Husband of";
    if (personData.Gender === "Female") relationLabel = "Loving Wife of";

    let html = "";

    personData._marriages.forEach(family => {
        if (!family.partners || family.partners.length !== 2) return;

        const spouse = family.partners.find(p => p.ID !== personData.ID);
        if (!spouse) return;

        const spouseName = spouse.Name?.split(" ")[0];
        if (!spouseName) return;

        // marriage year label
        const year = personData.YearOfMarriage || null;
        const marriageLabel = personData.YearOfMarriage ? `<span class="marriage-year">(💍${year})</span>` : "";

        html += `
            <section class="person-marriage">
                <div class="relation-block">
                    <div class="relation-icon">❤️</div>
                    <div class="relation-content">
                        <div class="relation-text">${relationLabel}</div>
                        <div class="relation-value">
                        ${spouseName}
                        ${marriageLabel}
                        </div>
                    </div>
                </div>
            </section>
        `;
    });

    return html;
}

/**
 * Helper to render children data on bottom sheet
 * @param {*} personData 
 * @returns children html
 */
function renderChildrenSection(personData) {
    if (!personData || !Array.isArray(personData._marriages) || !personData._marriages.length) return "";

    // get parent relation label
    let relationLabel = "";
    if (personData.Gender === "Male") relationLabel = "Proud Father of";
    if (personData.Gender === "Female") relationLabel = "Proud Mother of";

    let html = "";

    personData._marriages.forEach(family => {
        if (!Array.isArray(family.children) || !family.children.length) return;

        const childNames = family.children
            .map(child => child.Name?.split(" ")[0])
            .filter(Boolean)
            .join(", ");

        if (!childNames) return;

        html += `
            <section class="person-children">
                <div class="relation-block">
                <div class="relation-icon">🫶</div>
                <div class="relation-content">
                    <div class="relation-text">${relationLabel}</div>
                    <div class="relation-value">
                    ${childNames}
                    </div>
                </div>
                </div>
            </section>
        `;
    });

    return html;
}

/**
 * Helper to render notes data on bottom sheet
 * @param {*} personData 
 * @returns notes html
 */
function renderNotesSection(personData) {
    if (personData.Notes) {
        return `<section>${personData.Notes}</section>`;
    } else {
        return "";
    }
}

/**
 * Helper to resolve parents on demand
 * @param {*} personData 
 * @returns 
 */
function getParentsForPerson(personData) {
    const parents = [];

    if (personData.FatherID && peopleById.has(personData.FatherID)) {
        parents.push(peopleById.get(personData.FatherID));
    }

    if (personData.MotherID && peopleById.has(personData.MotherID)) {
        parents.push(peopleById.get(personData.MotherID));
    }

    return parents;
}
// ----

/* AUTOCOMPLETE AND SEARCH FUNCTIONALITY */

/**
 * Search helper function for autocomplete
 * @param {*} query user search input
 * @returns filtered index
 */
function searchPeople(query) {
    if (!query || query.length < 2) return [];

    const q = query.toLowerCase();

    return searchIndex.filter(p =>
        p.name.includes(q) ||
        p.nickname.includes(q)
    ).slice(0, 5); // limit results
}

/**
 * Renderes the search result
 * @param {*} results 
 */
function renderSearchResults(results) {
    const container = document.getElementById("search-results");
    container.innerHTML = "";

    results.forEach(person => {
        const item = document.createElement("div");
        item.className = "search-result";

        item.innerHTML = `
            <img src="${person.image}" onerror="this.src='${IMG_BASE_URL}def${person.raw.Gender}.jpg'"/>
            <span>${person.raw.Name}</span>
        `;

        container.style.display = "block";

        item.onclick = () => {
            selectPerson(person.raw.ID);
            clearSearch();
        };

        container.appendChild(item);
    });
}

/**
 * Two-pass search
 * @param {*} personId 
 * @returns the correct person/family node if found
 */
function findNodeForPerson(personId) {
    return treeRoot.descendants().find(d => {
        const data = d.data;

        // direct person node
        if (data.ID === personId) return true;

        // family node containing this person
        if (Array.isArray(data.partners) && data.partners.map(item => item.ID).includes(personId)) {
            return true;
        }

        return false;
    }) || null;
}

/**
 * Select Person → Center & Focus
 * @param {*} personId 
 */
function selectPerson(personId) {
    const targetNode = findNodeForPerson(personId);
    if (!targetNode) return;

    const isMobile = window.innerWidth < 768;
    const scale = isMobile ? 1.4 : 1;

    const container = document.getElementById("tree-container");
    const rect = container.getBoundingClientRect();

    const x = rect.width / 2 - targetNode.x * scale;
    const y = rect.height / 3 - targetNode.y * scale;

    svg.transition()
        .duration(750)
        .call(
            zoom.transform,
            d3.zoomIdentity.translate(x, y).scale(scale)
        );

    highlightNode(personId);
}

/**
 * Visual focus indicator
 * @param {*} personId 
 */
function highlightNode(personId) {
    // clear previous highlights
    d3.selectAll(".highlighted")
        .classed("highlighted", false);

    // highlight ALL representations of this person
    d3.selectAll(`[data-person-id="${personId}"]`)
        .classed("highlighted", true);
}

// Cache references for search | Wire Input → Autocomplete
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search-btn");
const searchResults = document.getElementById("search-results");

searchInput.addEventListener("input", (e) => {
    const results = searchPeople(e.target.value);
    renderSearchResults(results);
    clearSearchBtn.style.display = searchInput.value.trim() ? "block" : "none";
});

clearSearchBtn.addEventListener("click", () => {
    clearSearch();
});

/**
 * Clears the search query
 */
function clearSearch() {
    searchInput.value = "";
    clearSearchBtn.style.display = "none";

    // clear autocomplete results
    searchResults.innerHTML = "";
    searchResults.style.display = "none";

    searchInput.blur(); // optional, good for mobile
}

/**
 * ================================
 * Bottom Sheet (Mobile / Tablet)
 * ================================ 
 */

// Cache bottom-sheet elements
const bottomSheet = document.getElementById("person-bottom-sheet");
const bottomSheetPanel = bottomSheet.querySelector(".bottom-sheet-panel");
const bottomSheetContent = bottomSheet.querySelector(".bottom-sheet-content");
const bottomSheetBackdrop = bottomSheet.querySelector(".bottom-sheet-backdrop");
const bottomSheetHandle = bottomSheet.querySelector(".bottom-sheet-handle");
const bottomSheetCloseBtn = bottomSheet.querySelector(".bottom-sheet-close");

/**
 * Mobile / Tablet detection helpers 
 */
function isMobileOrTablet() {
  return window.matchMedia("(max-width: 1024px)").matches;
}

/**
 * Open bottom sheet
 * @param {*} html goes into the bottom sheet
 */
function openBottomSheet(html) {
    if (!bottomSheet) return;

    //   populate content
    bottomSheetContent.innerHTML = html;
    bottomSheet.classList.remove("hidden");

    // reset scroll position
    bottomSheetContent.scrollTop = 0;

    // force reflow so transition works
    bottomSheet.offsetHeight;

    // show sheet
    bottomSheet.classList.add("open");
    bottomSheetBackdrop.classList.add("active");
}

/**
 * Bottom sheet drag handle
 */
function enableBottomSheetDragToClose() {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    function onStart(e) {
        isDragging = true;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        bottomSheetPanel.style.transition = "none";
    }

    function onMove(e) {
        if (!isDragging) return;

        currentY = e.touches ? e.touches[0].clientY : e.clientY;
        const deltaY = Math.max(0, currentY - startY);

        bottomSheetPanel.style.transform = `translateY(${deltaY}px)`;
    }

    function onEnd() {
        if (!isDragging) return;
        isDragging = false;

        const deltaY = currentY - startY;
        const closeThreshold = 120;

        // clear inline transform control
        bottomSheetPanel.style.transition = "transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1)";

        if (deltaY > closeThreshold) {
            closeBottomSheet(0);
        } else {
            bottomSheetPanel.style.transform = "translateY(0)";
        }
    }

    // Touch
    bottomSheetHandle.addEventListener("touchstart", onStart);
    bottomSheetHandle.addEventListener("touchmove", onMove);
    bottomSheetHandle.addEventListener("touchend", onEnd);

    // Mouse
    bottomSheetHandle.addEventListener("mousedown", onStart);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
}

/**
 * Close bottom sheet
 */
function closeBottomSheet(timeout) {
    if (!bottomSheet) return;
    if(typeof timeout === 'object') timeout = 350;

    bottomSheet.classList.remove("open");
    bottomSheetBackdrop.classList.remove("active");

    // wait for animation to finish before cleanup
    setTimeout(() => {
        bottomSheetContent.innerHTML = "";
        bottomSheetPanel.style.transform = "";
        bottomSheetPanel.style.transition = "";
    }, timeout);
}

// Wire close interactions
bottomSheetBackdrop.addEventListener("click", closeBottomSheet);
bottomSheetCloseBtn.addEventListener("click", closeBottomSheet);

// Prevent panel clicks from closing sheet
document
  .querySelector(".bottom-sheet-panel")
  .addEventListener("click", (e) => {
    e.stopPropagation();
  });
// -----

// enable drag handle
enableBottomSheetDragToClose();