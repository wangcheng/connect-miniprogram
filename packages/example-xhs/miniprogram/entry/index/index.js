/* global Page, xhs */
const { main } = require('../../generated_modules/connect-client');
Page({
  onLoad(e) {
    console.log('onLoad', e);
    main();
  },
});
