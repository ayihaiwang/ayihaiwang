// Electron 模块加载补丁
// 在 Electron 主进程中，尝试修复 require('electron') 返回字符串的问题
if (process.versions && process.versions.electron && process.env.ELECTRON_RUN_AS_NODE !== '1') {
  const Module = require('module');
  const originalLoad = Module._load;
  
  Module._load = function(request, parent, isMain) {
    if (request === 'electron') {
      // 尝试从缓存中获取（如果之前已经加载过）
      const cacheKey = Module._resolveFilename(request, parent, false);
      if (Module._cache[cacheKey] && Module._cache[cacheKey].exports && typeof Module._cache[cacheKey].exports.app !== 'undefined') {
        return Module._cache[cacheKey].exports;
      }
      
      // 尝试使用原始加载器，但先删除 node_modules/electron 的缓存
      try {
        const electronPath = require.resolve('electron');
        delete Module._cache[electronPath];
        // 尝试直接调用原始加载器，看看是否能触发 Electron 的内置模块
        const result = originalLoad.call(this, request, parent, isMain);
        if (result && typeof result.app !== 'undefined') {
          return result;
        }
      } catch (e) {
        // 失败，继续正常流程
      }
    }
    return originalLoad.apply(this, arguments);
  };
}
