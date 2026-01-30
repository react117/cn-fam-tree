// Load CSV and normalize data
const width = 5000;
const height = 800;

const svg = d3.select("#tree-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(50,50)");

d3.csv("data/family.csv").then(data => {
    data.forEach(d => {
        d.YearOfBirth = +d.YearOfBirth || null;
        d.YearOfDeath = +d.YearOfDeath || null;
        d.Image = "https://raw.githubusercontent.com/react117/cn-fam-tree/master/assets/images/src/" + d.Name.replace(/\s/g, "") + ".jpg";
    });

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
        } else {
            familyNode = familyByKey.get(key);
        }

        familyNode.children.push(child);
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
    const root = d3.hierarchy(rootData);

    const treeLayout = d3.tree()
        .size([width - 200, height - 200]);

    treeLayout(root);

    // Links
    svg.selectAll(".link")
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
    const node = svg.selectAll(".node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    node.append("circle")
        .attr("r", d => d.data.type === "family" ? 6 : 18)
        .style("fill", d => d.data.type === "family" ? "#999" : "#fff");

    node.append("text")
        .filter(d => d.data.type !== "family")
        .attr("dy", 4)
        .attr("y", 30)
        .text(d => d.data.Name);
}
