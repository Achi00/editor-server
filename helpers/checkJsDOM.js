const acorn = require("acorn");
const estraverse = require("estraverse");

function needsDOMEnvironment(code) {
  const ast = acorn.parse(code, { ecmaVersion: "latest" });
  let usesDOM = false;

  estraverse.traverse(ast, {
    enter(node) {
      if (node.type === "Identifier") {
        const domGlobals = ["document", "window", "navigator"];
        if (domGlobals.includes(node.name)) {
          usesDOM = true;
          this.break();
        }
      }
    },
  });

  return usesDOM;
}

module.exports = needsDOMEnvironment;
