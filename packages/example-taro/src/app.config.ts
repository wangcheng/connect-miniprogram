export default defineAppConfig({
  pages: ['pages/grpc-web/index', 'pages/connect/index'],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'WeChat',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    position: 'top',
    list: [
      {
        pagePath: 'pages/grpc-web/index',
        text: 'GRPC Web',
      },
      {
        pagePath: 'pages/connect/index',
        text: 'Connect',
      },
    ],
  },
});
