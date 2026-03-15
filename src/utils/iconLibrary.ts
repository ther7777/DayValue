export interface IconOption {
  icon: string;
  label: string;
  keywords: string[];
  group: string;
}

export interface IconGroup {
  id: string;
  title: string;
  items: IconOption[];
}

const ICON_GROUP_DEFINITIONS: Array<{
  id: string;
  title: string;
  items: Array<{ icon: string; label: string; keywords: string[] }>;
}> = [
  {
    id: 'digital',
    title: '数码设备',
    items: [
      { icon: '📱', label: '手机', keywords: ['数码', '通讯', '电子', 'phone', 'mobile'] },
      { icon: '💻', label: '笔记本', keywords: ['电脑', '办公', 'laptop', 'pc'] },
      { icon: '🖥️', label: '显示器', keywords: ['屏幕', 'monitor', 'display'] },
      { icon: '⌨️', label: '键盘', keywords: ['外设', '输入', 'keyboard'] },
      { icon: '🖱️', label: '鼠标', keywords: ['外设', '输入', 'mouse'] },
      { icon: '📷', label: '相机', keywords: ['摄影', 'camera'] },
      { icon: '📹', label: '摄像机', keywords: ['录像', 'video'] },
      { icon: '📡', label: '网络设备', keywords: ['路由器', 'wifi', 'router'] },
      { icon: '💾', label: '存储设备', keywords: ['硬盘', 'ssd', 'storage'] },
      { icon: '🖨️', label: '打印设备', keywords: ['打印机', 'printer'] },
    ],
  },
  {
    id: 'audioVideo',
    title: '影音游戏',
    items: [
      { icon: '🎧', label: '耳机', keywords: ['音频', '耳麦', 'headphone'] },
      { icon: '🔊', label: '音箱', keywords: ['音响', 'speaker'] },
      { icon: '📺', label: '电视', keywords: ['客厅', 'tv'] },
      { icon: '📽️', label: '投影仪', keywords: ['投影', 'projector'] },
      { icon: '🎮', label: '游戏主机', keywords: ['娱乐', 'console', 'game'] },
      { icon: '🕹️', label: '游戏外设', keywords: ['手柄', 'controller'] },
      { icon: '🎤', label: '麦克风', keywords: ['录音', 'mic'] },
      { icon: '🎹', label: '乐器', keywords: ['音乐', 'instrument'] },
    ],
  },
  {
    id: 'home',
    title: '家电家居',
    items: [
      { icon: '🏠', label: '居家设备', keywords: ['家居', 'home'] },
      { icon: '🛋️', label: '家具', keywords: ['沙发', '桌椅', 'furniture'] },
      { icon: '🛏️', label: '床具', keywords: ['卧室', 'bed'] },
      { icon: '💡', label: '照明设备', keywords: ['灯具', 'light'] },
      { icon: '🧹', label: '清洁家电', keywords: ['扫地', 'clean'] },
      { icon: '🍳', label: '厨房家电', keywords: ['厨房', 'cooking'] },
      { icon: '🧊', label: '冷藏设备', keywords: ['冰箱', 'refrigerator'] },
      { icon: '🚿', label: '卫浴设备', keywords: ['卫浴', 'bathroom'] },
    ],
  },
  {
    id: 'transport',
    title: '出行装备',
    items: [
      { icon: '🚗', label: '汽车', keywords: ['出行', 'car'] },
      { icon: '🏍️', label: '摩托车', keywords: ['机车', 'motorcycle'] },
      { icon: '🚲', label: '自行车', keywords: ['骑行', 'bike'] },
      { icon: '🛴', label: '滑板车', keywords: ['电动滑板车', 'scooter'] },
      { icon: '🧳', label: '行李箱', keywords: ['旅行', 'suitcase'] },
      { icon: '🎒', label: '背包', keywords: ['通勤', 'bag'] },
      { icon: '⌚', label: '腕表', keywords: ['手表', 'watch'] },
      { icon: '⛺', label: '露营装备', keywords: ['户外', 'camp'] },
    ],
  },
  {
    id: 'fitness',
    title: '运动器材',
    items: [
      { icon: '🏋️', label: '力量器材', keywords: ['健身', 'fitness', 'gym'] },
      { icon: '🚴', label: '骑行器材', keywords: ['运动', 'cycling'] },
      { icon: '⚽', label: '球类器材', keywords: ['ball', 'sports'] },
      { icon: '🎿', label: '冰雪装备', keywords: ['滑雪', 'snow'] },
      { icon: '🧘', label: '拉伸器材', keywords: ['康复', 'yoga', 'stretch'] },
    ],
  },
  {
    id: 'professional',
    title: '专业工具',
    items: [
      { icon: '🛠️', label: '设备工具', keywords: ['维修', 'tool'] },
      { icon: '🧰', label: '工具箱', keywords: ['hardware', 'repair'] },
      { icon: '⚙️', label: '工程设备', keywords: ['machine', 'engineering'] },
      { icon: '🔬', label: '专业仪器', keywords: ['实验', 'lab'] },
      { icon: '📐', label: '测量工具', keywords: ['design', 'measure'] },
    ],
  },
  {
    id: 'service',
    title: '长期服务',
    items: [
      { icon: '💿', label: '软件服务', keywords: ['软件', 'software', 'app'] },
      { icon: '☁️', label: '云服务', keywords: ['网盘', 'cloud'] },
      { icon: '🎬', label: '视频会员', keywords: ['影视', 'streaming', 'video'] },
      { icon: '🎵', label: '音乐会员', keywords: ['音频', 'music'] },
      { icon: '🎓', label: '课程订阅', keywords: ['学习', 'course'] },
      { icon: '🪪', label: '会员权益', keywords: ['vip', 'membership'] },
      { icon: '💳', label: '储值卡', keywords: ['card', 'stored'] },
      { icon: '📦', label: '其他资产', keywords: ['其他', 'asset', 'package'] },
    ],
  },
];

export const ICON_LIBRARY_GROUPS: IconGroup[] = ICON_GROUP_DEFINITIONS.map(group => ({
  id: group.id,
  title: group.title,
  items: group.items.map(item => ({
    ...item,
    group: group.title,
  })),
}));

export const ICON_LIBRARY_OPTIONS: IconOption[] = ICON_LIBRARY_GROUPS.flatMap(group => group.items);

export const DEFAULT_ICON = ICON_LIBRARY_OPTIONS[0]?.icon ?? '📦';

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

export function findIconOption(icon: string | null | undefined): IconOption | null {
  if (!icon) return null;
  return ICON_LIBRARY_OPTIONS.find(option => option.icon === icon) ?? null;
}

export function searchIconGroups(query: string): IconGroup[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return ICON_LIBRARY_GROUPS;

  return ICON_LIBRARY_GROUPS.map(group => {
    const items = group.items.filter(item => {
      const haystack = `${group.title} ${item.label} ${item.keywords.join(' ')}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
    return { ...group, items };
  }).filter(group => group.items.length > 0);
}
