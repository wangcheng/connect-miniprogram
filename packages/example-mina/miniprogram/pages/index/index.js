Page({
  onReady: () => {
    require.async('../../generated_modules/connect-client').then(({ main }) => {
      main();
    });
  },
});
