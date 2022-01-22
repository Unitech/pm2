module.exports = {
  env: {
    es6: true,
    node: true,
  },
  extends: "eslint:recommended",
  overrides: [
    {
      env: { mocha: true },
      files: ["test/**"],
    },
  ],
  root: true,
  rules: {
    "no-control-regex": "off",
    "no-dupe-keys": "off",
    "no-empty": "warn",
    "no-extra-semi": "off",
    "no-global-assign": "off",
    "no-misleading-character-class": "off",
    "no-prototype-builtins": "off",
    "no-redeclare": "off",
    "no-unreachable": "off",
    "no-unused-vars": "warn",
    "no-useless-escape": "off",
    // "prefer-const": "error",
  },
};
