({
  greeting: function () {
    return "Welcome";
  },
  farewell: function () {
    return "Fair enough, right?";
  },
  name: "Chris",
  value: 10000,
  taxed_value: function () {
    return this.value - (this.value * 0.4);
  },
  in_ca: true
})
