# Chandraniloy Family Tree Visualization (D3.js)

An interactive, data-driven family tree built using **D3.js**, designed to visualize ancestral history in a clean, scalable, and maintainable way.

This project converts a structured CSV of family data into a hierarchical JSON format and renders it as an interactive horizontal family tree on a static website.

---

## 🎯 Project Goals

- Visualize a family tree of ~80 people
- Maintain all data in a **single CSV source of truth**
- Render a **horizontal, generation-based tree**
- Support:
  - Zoom & pan
  - Clickable nodes
  - Detailed popups per family member
- Host for free using **GitHub Pages**
- Version control all data and images using **GitHub**

---

## 🧱 Tech Stack

- **D3.js (v7)** – Tree layout & SVG rendering
- **HTML / CSS / JavaScript** – Static frontend
- **Node.js** – One-time CSV → JSON conversion
- **GitHub Pages** – Free static hosting

---

## 📁 Repository Structure

```pgsql
cn-fam-tree/
│
├── index.html              # Single-page entry point
│
├── css/
│   └── styles.css          # All styling (tree + popup)
│
├── js/
│   └── tree.js             # D3.js logic (CSV parsing + rendering)
│
├── data/
│   └── family.csv          # Family data with unique IDs
│
├── assets/
│   └── images/
│       └── src/            # ALL family member images live here
│
└── README.md
```

---

## 📄 Data Model

### 📊 CSV Schema

The family data lives in data/family.csv.

Each row represents one person.

| Column Name | Description 
|--|--|
| `ID` | Unique identifier for each person (**required**) |
| `Name` | Full name |
| `Nickname` | Nickname (**optional**) |
| `Gender` | Male / Female / Other |
| `YearOfBirth` | Birth year |
| `YearOfDeath` | Death year (**optional**) |
| `Profession` | Profession or role |
| `FatherID` | ID of father (**nullable**) |
| `MotherID` | ID of mother (**nullable**) |
| `MarriedToID` | ID of spouse (**nullable**) |
| `Image` | Image URL (**GitHub raw URL recommended**) |
| `Notes` | Additional notes |

### Example

```csv
ID,Name,Gender,YearOfBirth,FatherID,MotherID,Image
P001,Ram Kumar,Male,1945,,,https://raw.githubusercontent.com/username/repo/main/assets/images/ram.jpg
P002,Sita Devi,Female,1950,,,https://raw.githubusercontent.com/username/repo/main/assets/images/sita.jpg
P003,Amit Kumar,Male,1975,P001,P002,
```

---

## 🧠 How It Works

1. `CN_Family_Tree.csv` is loaded using `d3.csv()`
2. Each person is mapped by `ID`
3. Parent-child relationships are built using `FatherID` and `MotherID`
4. D3’s `tree()` layout renders the hierarchy
5. Clicking a node opens a popup with full details

---

## 🖼️ Images

Images are stored in the `GitHub repository`

Referenced using raw GitHub URLs:

```java
https://raw.githubusercontent.com/<username>/<repo>/main/assets/images/photo.jpg
```

This keeps everything version-controlled and works seamlessly with GitHub Pages.

---

## 🚀 Running Locally

Because browsers block local CSV loading, use a simple local server:

### Option 1: VS Code Live Server

- Install Live Server extension
- Right-click `index.html` → Open with Live Server

### Option 2: Python

```bash
python -m http.server
```

Then open:

```arduino
http://localhost:8000
```

## 🌐 Deployment (`GitHub Pages`)

1. Push the repository to GitHub
2. Go to Settings → Pages
3. Select:
    - Source: main
    - Folder: /root
4. Save

**Your site will be live at:**

```java
https://<username>.github.io/<repo-name>/
```
