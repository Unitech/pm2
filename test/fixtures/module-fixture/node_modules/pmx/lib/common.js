
var Common = module.exports =  {};

Common.getDate = function getDate() {
  return Math.round(Date.now() / 1000);
};
