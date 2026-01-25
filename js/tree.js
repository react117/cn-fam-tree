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
    });

    // console.log(data);

    buildTree(data);
});

/** Build hierarchy using IDs
 *  - Map every person by ID
 *  - Attach children to parents
 *  - Pick a root ancestor
*/
function buildTree(data) {
    const peopleById = new Map();

    data.forEach(person => {
        person.children = [];
        peopleById.set(person.ID, person);
    });

    // console.log(peopleById);

    let root = null;

    data.forEach(person => {
        if(person.Name === 'Ardhendu Bhattacharya') {
             console.log(person);
        }

        if (person.FatherID && peopleById.has(person.FatherID)) {
            console.log(person.Name);
            peopleById.get(person.FatherID).children.push(person);
        } else if (person.MotherID && peopleById.has(person.MotherID)) {
            console.log(person.Name);
            peopleById.get(person.MotherID).children.push(person);
        } else {
            // No parents and any parentIDs !=== P000 → root candidate
            // Any parentIDs === P000 → spouse candidate
            if(person.FatherID === 'P000' || person.MotherID === 'P000') {
                // Spouse Logic
            } else{
                root = person;
            }
        }
    });

    console.log(root);

    renderTree(root);
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
    const node = svg.selectAll(".node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    node.append("circle")
        .attr("r", 18);

    node.append("text")
        .attr("dy", 4)
        .attr("y", 30)
        .text(d => d.data.Name);
}
