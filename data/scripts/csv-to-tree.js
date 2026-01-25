const fs = require("fs");
const csv = require("csv-parser");

const people = {};
const roots = [];

function clean(value) {
  return value ? value.trim() : "";
}

fs.createReadStream("data/family.csv")
  .pipe(csv())
  .on("data", row => {
    const name = clean(row.Name);
    if (!name) return;

    people[name] = {
      Name: name,
      Nickname: clean(row.Nickname),
      Gender: clean(row.Gender),
      BirthYear: clean(row["YearOfBirth"]),
      DeathYear: clean(row["YearOfDeath"]),
      Profession: clean(row.Profession),
      Father: clean(row.Father),
      Mother: clean(row.Mother),
      Married_to: clean(row.Married_to),
      Image: clean(row.Image),
      Notes: clean(row.Notes),
      children: []
    };
  })
  .on("end", () => {
    Object.values(people).forEach(person => {
      if (person.Father && people[person.Father]) {
        people[person.Father].children.push(person);
      } else {
        roots.push(person);
      }
    });

    if (roots.length === 0) {
      console.error("❌ No root ancestor found. Check Father column.");
      return;
    }

    if (roots.length > 1) {
      console.warn(
        "⚠️ Multiple root ancestors detected. Using the first one."
      );
    }

    fs.writeFileSync(
      "data/family.json",
      JSON.stringify(roots[0], null, 2)
    );

    console.log("✅ Phase 1 complete: family.json generated");
    console.log(`👥 Total people: ${Object.keys(people).length}`);
  });
