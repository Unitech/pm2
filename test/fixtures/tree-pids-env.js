// Reports what the app received as process.env._tree_pids (stale _tree_pids)
require('fs').writeFileSync(process.env.TREE_PIDS_OUT, JSON.stringify({
  pid       : process.pid,
  tree_pids : process.env._tree_pids === undefined ? null : process.env._tree_pids
}));

setInterval(function() {}, 1000);
