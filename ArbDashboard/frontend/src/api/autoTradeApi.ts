/**
 * 自动交易引擎 API
 */
import client from './client'

/** 获取引擎状态 */
export function getAutoTradeStatus() {
  return client.get('/api/auto_trade/status')
}

/** 获取规则列表 */
export function getAutoTradeRules() {
  return client.get('/api/auto_trade/rules')
}

/** 新增规则 */
export function addAutoTradeRule(data: Record<string, any>) {
  return client.post('/api/auto_trade/rules/add', data)
}

/** 更新规则 */
export function updateAutoTradeRule(ruleId: string, data: Record<string, any>) {
  return client.post(`/api/auto_trade/rules/update/${ruleId}`, data)
}

/** 删除规则 */
export function deleteAutoTradeRule(ruleId: string) {
  return client.delete(`/api/auto_trade/rules/${ruleId}`)
}

/** 批量更新规则 */
export function updateAllAutoTradeRules(rules: Record<string, any>[]) {
  return client.post('/api/auto_trade/rules', { rules })
}

/** 启动/停止引擎 */
export function toggleAutoTradeEngine(action: 'start' | 'stop') {
  return client.post('/api/auto_trade/toggle', { action })
}

/** 获取引擎日志 */
export function getAutoTradeLogs() {
  return client.get('/api/auto_trade/logs')
}

/**
 * SignalDetector API
 */

/** 获取 SignalDetector 状态 */
export function getSignalDetectorStatus() {
  return client.get('/api/signal_detector/status')
}

/** 启动/停止 SignalDetector */
export function toggleSignalDetector(action: 'start' | 'stop') {
  return client.post('/api/signal_detector/toggle', { action })
}

/** 获取 SignalDetector 日志 */
export function getSignalDetectorLogs() {
  return client.get('/api/signal_detector/logs')
}

/** @deprecated 使用 getSignalDetectorStatus */
export const getExecutorStatus = getSignalDetectorStatus
/** @deprecated 使用 toggleSignalDetector */
export const toggleExecutor = toggleSignalDetector
/** @deprecated 使用 getSignalDetectorLogs */
export const getExecutorLogs = getSignalDetectorLogs
