// chacks if user code uses jsdom
const acorn = require("acorn");
const estraverse = require("estraverse");

function needsDOMEnvironment(code) {
  const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: "module" });

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
