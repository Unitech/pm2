process.chdir(__dirname)

const config = require('../../lib/tools/Config')
const { performance } = require('perf_hooks')
const { expect } = require('chai')


describe('ReDos Test', function () {
  it('should done in 1 s', function () {
    // 构造 schema，期望值为数组或者字符串
    const schemaEntry = {
      type: ['array', 'string']
    }
    // 构造测试用的长字符串
    const value = "a".repeat(100000) + "="

    const startTime = performance.now()
    const result = config._valid('dummyKey', value, schemaEntry)
    const endTime = performance.now()
    const timeTaken = endTime - startTime

    // 输出匹配结果和耗时（调试用）
    console.log(`Time taken: ${timeTaken.toFixed(3)} ms`)


    // 并断言耗时在合理范围内（比如小于1000毫秒）
    expect(timeTaken).to.be.lessThan(1000)
  })
})
