// Load CSV and normalize data
const WIDTH = 5000;
const HEIGHT = window.innerHeight;
const IMG_BASE_URL = "https://raw.githubusercontent.com/react117/cn-fam-tree/master/assets/images/src/";
const NODE_RADIUS = 32;
const personNodeMap = new Map();
const INITIAL_TRANSLATE_X = WIDTH / 4;
const INITIAL_TRANSLATE_Y = 100;
const TREE_DEFAULT_SCALE = 0.8;
const CARD_WIDTH = 120;
const CARD_HEIGHT = 160;
let searchIndex = null;
let treeRoot = null;

const svg = d3.select("#tree-container")
    .append("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .style("touch-action", "none");

const treeGroup = svg.append("g")
    .attr("class", "tree-container");

// zoom behavior
const zoom = d3.zoom()
    .scaleExtent([0.3, 2.5]) // min zoom, max zoom
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
    .translate(WIDTH / 4, 100)
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
    const peopleById = new Map();
    const familyByKey = new Map();

    // Initialize people
    data.forEach(person => {
        person.children = [];
        person._families = [];
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
                type: "family",
                parents: [father, mother],
                children: []
            };

            familyByKey.set(key, familyNode);

            father._families.push(familyNode);
            mother._families.push(familyNode);

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
                type: "family",
                parents: [person, spouse],
                children: []
            };

            familyByKey.set(key, familyNode);

            person._families.push(familyNode);
            spouse._families.push(familyNode);

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
 * Person
 * └── Family
 *     └── Child
 * 
 * The virtual family node: 
 * - Do not exist in CSV
 * - Are created in JS
 * - Represent a married couple
 * - Act as the only parent of children
 * 
 * @param {*} person 
 * @returns each person as a node introducing _families
 * 
 * @array person._families def
 * If: FatherID = P001 && MotherID = P002
 * We create: _families with ID: FAM_P001_P002
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

    if (person._families) {
        person._families.forEach(family => {
            const familyNode = {
                ID: family.ID,
                type: "family",
                parents: family.parents, // KEEP parents
                children: family.children.map(child =>
                    buildHierarchy(child)
                )
            };
            
            node.children.push(familyNode);
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
            d.data.type === "family" ? "node family-node" : "node person-node"
        )
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .attr("data-person-id", d => d.data.ID);
    // ------

    // person card default padding
    const FO_PADDING = 30;

    // render family nodes | married | have children
    node.filter(d => d.data.type === "family")
    .each(function (d) {
        const familyGroup = d3.select(this);
        const spouses = d.data.parents || [];

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
                    // event.preventDefault();
                    event.stopPropagation();
                    showPopup(event, person);
                });
        });
    });
    // ------

    // render single people nodes | not married | no children
    node
        .filter(d => d.data.type !== "family" && !d.data._isSpouse)
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
            showPopup(event, d.data);
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
// ----

// Node Details Popup Logic
const popup = d3.select("#popup");

function showPopup(event, data) {
    popup
        .classed("hidden", false)
        .html(`
            <img 
                src="${data.Image}" 
                alt="${data.Name}" 
                onerror="this.onerror=null;this.src='${IMG_BASE_URL}def${data.Gender}.jpg';"
            />
            <h3>${data.Name}</h3>
            ${data.Nickname ? `<div class="meta">"${data.Nickname}"</div>` : ""}
            <div><strong>Gender:</strong> ${data.Gender || "—"}</div>
            <div><strong>Born:</strong> ${data.YearOfBirth || "—"}</div>
            <div><strong>Died:</strong> ${data.YearOfDeath || "—"}</div>
            <div><strong>Profession:</strong> ${data.Profession || "—"}</div>
            ${data.Notes ? `<div><strong>Notes:</strong> ${data.Notes}</div>` : ""}
        `)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
}

/**
 * This ensures:
 * Broken URLs don’t show broken icons
 * Popup stays clean
 */
popup.on("error", "img", function () {
  d3.select(this).remove();
});

// Close popup when clicking elsewhere
d3.select("body").on("click", () => {
    popup.classed("hidden", true);
});

// Stop event propagation on popup click
popup.on("click", event => event.stopPropagation());

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
        if (Array.isArray(data.parents) && data.parents.map(item => item.ID).includes(personId)) {
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
    const y = rect.height / 2 - targetNode.y * scale;

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