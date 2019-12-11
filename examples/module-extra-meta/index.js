
var pmx = require('pmx');

/**
 * set "PM2_WAIT_FOR_INIT" : TIME to tell PM2 to show human infos
 */
pmx.configureModule({
  human_info : [
    [ 'Description',  'Gridcontrol is now running, tasdkkals dk als dkl askdl\nasd lsdakl kdsald asdsd\nAnd hthis like that and bla blab\nYESY!' ],
    [ 'Port',  8000],
    [ 'Grid name', 'Sisi la grid']
  ]
});

setInterval(() => {}, 1000);
