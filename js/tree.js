// Load CSV and normalize data
const WIDTH = 5000;
const HEIGHT = 1000;
const IMG_BASE_URL = "https://raw.githubusercontent.com/react117/cn-fam-tree/master/assets/images/src/";
const NODE_RADIUS = 32;
const TREE_DEFAULT_SCALE = 0.75;

const svg = d3.select("#tree-container")
    .append("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT);

const treeGroup = svg.append("g")
    .attr("class", "tree-container")
    .attr("transform", `translate(${WIDTH / 4}, 100) scale(${TREE_DEFAULT_SCALE})`);

// zoom behavior
const zoom = d3.zoom()
    .scaleExtent([0.3, 2.5]) // min zoom, max zoom
    .filter(event => event.type === "wheel" || !event.target.closest(".node")) // allows drag/pan only on empty spaces, zoom everywhere
    .on("zoom", (event) => {
        treeGroup.attr("transform", event.transform);
    });

svg.call(zoom);

// Set initial position [Solves the jump/jerk on 1st zoom/pan]
svg.call(zoom.transform, d3.zoomIdentity.translate(WIDTH / 4, 100).scale(TREE_DEFAULT_SCALE));
// --

d3.csv("data/family.csv").then(data => {
    data.forEach(d => {
        d.YearOfBirth = +d.YearOfBirth || null;
        d.YearOfDeath = +d.YearOfDeath || null;
        d.Image = IMG_BASE_URL + d.Name.replace(/\s/g, "") + ".jpg";
    });

    // console.log(data);

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

    console.log(data);

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

    const root = d3.hierarchy(rootData);

    const treeLayout = d3.tree()
        .nodeSize([180, 200]); // [horizontal spacing (siblings / cousins), vertical spacing (generations)]
    
    root.descendants().forEach(d => {
        d.x = 18000;
        d.y = d.depth * 1800;
    });

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
        .attr("transform", d => `translate(${d.x},${d.y})`);
    // ------

    // render family nodes
    // - married
    // - have children
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
            .attr("transform", `translate(${xOffset}, -50)`);

            // border
            personGroup.append("circle")
                .attr("r", NODE_RADIUS)
                .style("fill", "#999")
                .attr("stroke", "#bbb")
                .attr("stroke-width", 2);

            // image
            personGroup
                .append("image")
                .attr("xlink:href", d => person.Image)
                .attr("x", -NODE_RADIUS)
                .attr("y", -NODE_RADIUS)
                .attr("width", NODE_RADIUS * 2)
                .attr("height", NODE_RADIUS * 2)
                .attr("clip-path", "url(#node-circle-clip)")
                .attr("preserveAspectRatio", "xMidYMid slice")
                .on("error", function (event, d) {
                    const el = d3.select(this);

                    if (el.attr("data-fallback")) return;

                    const fallback = IMG_BASE_URL + "def" + person.Gender + ".jpg";

                    el.attr("data-fallback", "true")
                    .attr("xlink:href", fallback);
                });

            // add name
            personGroup.append("text")
                .attr("dy", 4)
                .attr("y", 40)
                .text(d => person.Name);

            // popup
            personGroup.on("click", (event) => {
                // event.preventDefault();
                event.stopPropagation();
                showPopup(event, person);
            });
        });
    });
    // ------

    // render single people nodes
    // - not married
    // - no children
    node.filter(d => d.data.type !== "family" && !d.data._isSpouse) // family node exists but invisible.
        .append("circle")
        .attr("r", NODE_RADIUS)
        .style("fill", "#999")
        .attr("stroke", "#bbb")
        .attr("stroke-width", 2)
        .on("click", (event, d) => {
            if (d.data.type === "family") return;
            event.stopPropagation(); // Stop event propagation on node click
            showPopup(event, d.data);
        });

    // add image inside person nodes
    // loads the image
    // clips it into a circle
    // falls back safely
    node.filter(d => d.data.type !== "family" && !d.data._isSpouse)
        .append("image")
        .attr("xlink:href", d => d.data.Image)
        .attr("x", -NODE_RADIUS)
        .attr("y", -NODE_RADIUS)
        .attr("width", NODE_RADIUS * 2)
        .attr("height", NODE_RADIUS * 2)
        .attr("clip-path", "url(#node-circle-clip)")
        .attr("preserveAspectRatio", "xMidYMid slice")
        .on("error", function (event, d) {
            const el = d3.select(this);

            if (el.attr("data-fallback")) return;

            const fallback = IMG_BASE_URL + "def" + d.data.Gender + ".jpg";

            el.attr("data-fallback", "true")
            .attr("xlink:href", fallback);
        });

    // add name
    node.filter(d => d.data.type !== "family" && !d.data._isSpouse)
        .append("text")
        .attr("dy", 4)
        .attr("y", 40)
        .text(d => d.data.Name);
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

