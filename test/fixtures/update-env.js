setInterval(() => {
  const { SH, PM, SH_PM } = process.env;

  console.log(`SH=${SH} PM=${PM} SH_PM=${SH_PM}`);
}, 100);
