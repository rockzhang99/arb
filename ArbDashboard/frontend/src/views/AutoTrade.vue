<template>
  <div class="auto-trade-container">
    <n-grid :cols="24" :x-gap="12" :y-gap="12">
      <!-- 顶部：引擎控制 -->
      <n-gi :span="24">
        <n-card class="shadow-soft header-card">
          <div class="flex-between">
            <div class="flex-center gap-4">
              <n-icon size="32" color="#3b82f6"><Bot /></n-icon>
              <div>
                <div class="header-title">策略规则</div>
                <div class="header-subtitle"></div>
              </div>
              <n-tag :bordered="false" round :type="engineRunning ? 'success' : 'error'" class="status-badge">
                <template #icon><n-icon><Activity /></n-icon></template>
                {{ engineRunning ? '信号检测: 运行中' : '信号检测: 停止' }}
              </n-tag>
            </div>
            <n-space>
              <n-button :type="engineRunning ? 'error' : 'success'" secondary @click="toggleEngine" :loading="toggling">
                <template #icon><n-icon><Power /></n-icon></template>
                {{ engineRunning ? '停止检测' : '开启检测' }}
              </n-button>
            </n-space>
          </div>
        </n-card>
      </n-gi>

      <!-- 左侧：实时信号日志 -->
      <n-gi :span="10">
        <n-card title="信号日志" :bordered="false" class="shadow-soft full-height">
          <div class="log-terminal">
            <div v-if="logs.length === 0" class="log-empty">等待信号扫描触发...</div>
            <div v-for="(log, index) in logs" :key="index" class="log-line">
              <span class="l-time">[{{ log.time }}]</span>
              <span :class="['l-level', log.level.toLowerCase()]">[{{ log.level }}]</span>
              <span class="l-msg">{{ log.message }}</span>
            </div>
          </div>
        </n-card>
      </n-gi>

      <!-- 右侧：策略规则管理 -->
      <n-gi :span="14">
        <n-card title="活跃套利策略" :bordered="false" class="shadow-soft full-height">
          <template #header-extra>
            <n-button type="primary" size="small" @click="openAddModal">
              <template #icon><n-icon><Plus /></n-icon></template>
              新增规则
            </n-button>
          </template>
          <n-data-table
            :columns="ruleColumns"
            :data="rules"
            size="small"
            bordered
            :pagination="{ pageSize: 8 }"
          />
        </n-card>
      </n-gi>
    </n-grid>

    <!-- 新增/编辑规则弹窗 -->
    <n-modal v-model:show="showModal" preset="card" :title="editId ? '编辑规则' : '新增规则'" style="width: 550px;">
      <n-form :model="formModel" label-placement="left" label-width="100">
        <n-form-item label="策略名称">
          <n-input v-model:value="formModel.name" placeholder="起个直观的名字" />
        </n-form-item>
        <n-form-item label="监视对象">
          <n-input v-model:value="formModel.target" placeholder="基金代码 (162411) 或 分类 (黄金原油)" />
        </n-form-item>
        <n-form-item label="触发条件">
          <n-radio-group v-model:value="formModel.indicator">
            <n-radio value="discount">折价</n-radio>
            <n-radio value="premium">溢价</n-radio>
          </n-radio-group>
          <n-input-number v-model:value="formModel.threshold" :precision="2" style="width: 120px; margin-left: 12px;" />
          <span style="margin-left: 8px">%</span>
        </n-form-item>
        <n-form-item label="动作方向">
          <n-select v-model:value="formModel.action" :options="[
            {label: '做多（买LOF+空ETF）', value: 'OPEN'},
            {label: '平仓（卖LOF+平ETF）', value: 'CLOSE'}
          ]" />
        </n-form-item>
        
        <div class="flex-end gap-2 mt-4">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" @click="handleSave">{{ editId ? '更新规则' : '保存' }}</n-button>
        </div>
      </n-form>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, h, reactive } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard, NGrid, NGi, NTag, NButton, NDataTable, NSwitch, NIcon, 
  useMessage, NEmpty, NSpace, NText, NTable, NModal, NForm, NFormItem,
  NInput, NInputNumber, NRadioGroup, NRadio, NSelect
} from 'naive-ui'
import { Power, Bot, Activity, Plus, Trash2, Edit, Ban } from 'lucide-vue-next'
import {
  getSignalDetectorStatus, getAutoTradeRules, getSignalDetectorLogs,
  addAutoTradeRule, updateAutoTradeRule, deleteAutoTradeRule,
  toggleSignalDetector
} from '../api'

const message = useMessage()
const router = useRouter()
const engineRunning = ref(false)
const toggling = ref(false)
const rules = ref([])
const logs = ref([])
const showModal = ref(false)
const editId = ref<string | null>(null)
let timer: any = null

const formModel = reactive({
  name: '',
  target: '',
  type: 'code',
  indicator: 'discount',
  threshold: 0.7,
  action: 'OPEN'
})

const fetchStatus = async () => {
  const res = await getSignalDetectorStatus()
  engineRunning.value = res.data.running
}

const fetchRules = async () => {
  try {
    const res = await getAutoTradeRules()
    const allRules = res.data.rules || []
    allRules.sort((a: any, b: any) => (b.enabled ? 1 : 0) - (a.enabled ? 1 : 0))
    rules.value = allRules
  } catch (e) {
    message.error('加载规则失败')
  }
}

const openAddModal = () => {
  editId.value = null
  Object.assign(formModel, { name: '', target: '', indicator: 'discount', threshold: 0.7, action: 'OPEN' })
  showModal.value = true
}

const openEditModal = (row: any) => {
  editId.value = row.id
  Object.assign(formModel, row)
  showModal.value = true
}

const handleSave = async () => {
  try {
    if (editId.value) {
      await updateAutoTradeRule(editId.value, formModel)
    } else {
      await addAutoTradeRule(formModel)
    }
    message.success('规则已更新')
    showModal.value = false
    fetchRules()
  } catch (e) {
    message.error('保存失败')
  }
}

const deleteRule = async (id: string) => {
  try {
    await deleteAutoTradeRule(id)
    message.warning('规则已删除')
    fetchRules()
  } catch (e) {
    message.error('删除失败')
  }
}

const fetchLogs = async () => {
  const res = await getSignalDetectorLogs()
  logs.value = res.data.logs
}

const fetchAll = () => {
  fetchStatus()
  fetchRules()
  fetchLogs()
}

const toggleEngine = async () => {
  toggling.value = true
  const action = engineRunning.value ? 'stop' : 'start'
  try {
    const res = await toggleSignalDetector(action)
    engineRunning.value = res.data.running
    message.success(engineRunning.value ? '信号检测已开启' : '信号检测已停止')
  } finally {
    toggling.value = false
  }
}

const toggleStatus = async (row: any, val: boolean) => {
  try {
    row.enabled = val
    await updateAutoTradeRule(row.id, { enabled: val })
    message.info(`${row.name} 已${val ? '开启' : '关闭'}`)
  } catch (e) {
    message.error('操作失败')
  }
}

const ruleColumns = [
  {
    title: '开关', key: 'enabled', width: 60, align: 'center',
    render(row: any) {
      return h(NSwitch, {
        value: row.enabled,
        size: 'small',
        onUpdateValue: (val: boolean) => toggleStatus(row, val)
      })
    }
  },
  { title: '规则名称', key: 'name', render: (row: any) => h(NText, { strong: true }, { default: () => row.name }) },
  { title: '监控对象', key: 'target', width: 100, align: 'center', className: 'col-target' },
  {
    title: '触发条件', key: 'logic', width: 180, align: 'center',
    render(row: any) {
      const isD = row.indicator === 'discount'
      const isOpen = row.action === 'OPEN' || row.action === 'BUY'
      return h('div', [
        h(NTag, { type: isD ? 'success' : 'error', size: 'tiny', ghost: true }, { default: () => isD ? '折价' : '溢价' }),
        h('span', { style: 'margin-left: 5px' }, `> ${row.threshold}%`),
        h('br'),
        h(NTag, { type: isOpen ? 'info' : 'warning', size: 'tiny', ghost: true, style: 'margin-top: 2px' }, { default: () => isOpen ? '开仓（买LOF+空ETF）' : '平仓（卖LOF+平ETF）' })
      ])
    }
  },
  {
    title: '操作', key: 'actions', width: 150, align: 'center',
    render(row: any) {
      return h(NSpace, { justify: 'center' }, { default: () => [
        h(NButton, { quaternary: true, circle: true, size: 'tiny', onClick: () => openEditModal(row) }, { default: () => h(NIcon, null, { default: () => h(Edit) }) }),
        h(NButton, { quaternary: true, circle: true, size: 'tiny', type: 'error', onClick: () => deleteRule(row.id) }, { default: () => h(NIcon, null, { default: () => h(Trash2) }) }),
        h(NButton, { quaternary: true, circle: true, size: 'tiny', type: 'error',
          onClick: () => router.push({ path: '/lazymode', query: { code: row.target, name: row.name } })
        }, { default: () => h(NIcon, null, { default: () => h(Ban) }) })
      ]})
    }
  }
]

onMounted(() => {
  fetchAll()
  timer = setInterval(fetchAll, 3000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.auto-trade-container { padding: 16px; background-color: #f8fafc; min-height: 100vh; }
.header-card { padding: 8px 16px; border-radius: 16px; margin-bottom: 12px; }
.header-title { font-size: 20px; font-weight: 800; color: #1e293b; }
.header-subtitle { font-size: 12px; color: #64748b; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.flex-center { display: flex; align-items: center; }
.flex-end { display: flex; justify-content: flex-end; }
.gap-4 { gap: 16px; }
.shadow-soft { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04); border-radius: 12px; }
.full-height { height: 420px; overflow-y: auto; }
.log-card { margin-top: 12px; }
.log-terminal { 
  background-color: #0f172a; border-radius: 8px; padding: 12px; height: 260px; 
  overflow-y: auto; font-family: 'Fira Code', monospace; font-size: 12px;
}
.log-line { margin-bottom: 4px; display: flex; gap: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 2px; }
.l-time { color: #64748b; flex-shrink: 0; }
.l-level.info { color: #3b82f6; font-weight: bold; }
.l-level.warning { color: #f59e0b; }
.l-level.error { color: #ef4444; }
.l-msg { color: #e2e8f0; }
.log-empty { color: #475569; text-align: center; margin-top: 100px; }
.num-font { font-family: 'Inter', sans-serif; font-variant-numeric: tabular-nums; }
.text-blue { color: #3b82f6; font-weight: bold; }
.text-orange { color: #f59e0b; font-weight: bold; }
.mt-4 { margin-top: 16px; }
.position-masked { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; }
.mask-icon { font-size: 32px; margin-bottom: 12px; }
.mask-text { font-size: 16px; font-weight: 700; color: #94a3b8; }
.mask-sub { font-size: 12px; color: #cbd5e1; margin-top: 4px; }
:deep(.col-target) .n-data-table-td { padding-left: 8px !important; }
</style>
