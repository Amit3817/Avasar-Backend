module.exports = async function globalTeardown() {
  if (global.__MONGOINSTANCE__) {
    await global.__MONGOINSTANCE__.stop();
  }
}; 