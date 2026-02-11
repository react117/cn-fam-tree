# Chandraniloy Family Tree Visualization (D3.js)

An interactive, data-driven family tree built using **D3.js**, designed to visualize ancestral history in a clean, scalable, and maintainable way.

This project converts a structured CSV of family data into a hierarchical JSON format and renders it as an interactive horizontal family tree on a static website.

---

## 🎯 Project Goals

- Visualize a family tree of ~80+ people
- Maintain all data in a **single CSV source of truth**
- Render a **horizontal, generation-based tree**
- Ensure **correct family and marriage semantics**
- Support:
  - Zoom & pan
  - Search with autocomplete
  - Clickable nodes with detailed views
- Work seamlessly on **desktop and mobile**
- Host for free using **GitHub Pages**
- Version control all data and assets using **GitHub**

---

## 🧱 Tech Stack

- **D3.js (v7)** – Tree layout & SVG rendering
- **HTML / CSS / JavaScript** – Static frontend
- **GitHub Pages** – Free static hosting

---

## ✨ Key Features

### 🌳 Family Tree Visualization
- Horizontal, generation-based layout
- Correct parent-child and spouse relationships
- Dedicated marriage modeling

### 🔍 Search
- Search by name or nickname
- Autocomplete results
- Pan & zoom to selected person

### 📱 Mobile Support
- Responsive header and search placement
- Mobile bottom sheet for person details
- Touch-friendly interactions
- Stable keyboard behavior on mobile browsers

### 🧾 Person Details
- Click or tap a node to view full details
- Profession, lifespan, notes, and relationships
- Optimized layout for both desktop and mobile

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
| `YearOfMarriage` | Marriage year (**optional**) |
| `ImgPosX` | Horizontal image position offset (**nullable**) |
| `ImgPosY` | Vertical image position offset (**nullable**) |
| `CardPosX` | Horizontal person-card position offset (**nullable**) |
| `CardPosY` | Horizontal person-card position offset (**nullable**) |
| `Notes` | Additional notes |

,,,,

### Example

```csv
ID,Name,Gender,YearOfBirth,FatherID,MotherID,MarriedToID,YearOfMarriage,ImgPosX,ImgPosY,CardPosX,CardPosY,Notes
P001,Ram Kumar,Male,1945,,,,,,,,,,
P002,Sita Devi,Female,1950,,,,,,,,,,
P003,Amit Kumar,Male,1975,P001,P002,,,,,,,
```

---

## 🧠 How It Works

1. `family.csv` is loaded using `d3.csv()`
2. Each person is indexed by `ID`
3. Parent-child relationships are constructed
4. Marriage relationships are modeled separately
5. D3’s `tree()` layout computes node positions
6. SVG nodes and links are rendered
7. User interactions (search, click, pan, zoom) update the view dynamically

---

## 🖼️ Images

Images are stored in the `GitHub repository`

Referenced using raw GitHub URLs:

```java
https://raw.githubusercontent.com/<username>/<repo>/main/assets/images/src/photo.jpg
```

This keeps everything version-controlled and works seamlessly with GitHub Pages.

---

## 🚀 Running Locally

Because browsers block local CSV loading, use a simple local server:

### Option 1: VS Code Live Server

- Install Live Server extension (`Vscode`)
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
    - Source: master
    - Folder: /root
4. Save

**Your site will be live at:**

```java
https://<username>.github.io/<repo-name>/
```

## ❤️ Credits

- Built & maintained by **[react117](https://github.com/react117)**
- Data maintained by **Surjya Sarathi Bhattacharyya**
- Expanded on the data structured by **[Sutirtho Sen](https://github.com/sutirsen)**