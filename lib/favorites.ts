// 收藏夹数据类型和管理逻辑

export type Favorite = {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = 'mermaid-favorites';

// 获取所有收藏
export function getFavorites(): Favorite[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 添加收藏
export function addFavorite(name: string, code: string): Favorite {
  const favorites = getFavorites();
  const newFavorite: Favorite = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    code,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  favorites.unshift(newFavorite);
  saveFavorites(favorites);
  return newFavorite;
}

// 更新收藏
export function updateFavorite(id: string, updates: Partial<Pick<Favorite, 'name' | 'code'>>): void {
  const favorites = getFavorites();
  const index = favorites.findIndex(f => f.id === id);
  if (index !== -1) {
    favorites[index] = {
      ...favorites[index],
      ...updates,
      updatedAt: Date.now(),
    };
    saveFavorites(favorites);
  }
}

// 删除收藏
export function deleteFavorite(id: string): void {
  const favorites = getFavorites().filter(f => f.id !== id);
  saveFavorites(favorites);
}

// 保存收藏列表
function saveFavorites(favorites: Favorite[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Failed to save favorites:', error);
  }
}

const INITIALIZED_KEY = 'mermaid-favorites-initialized';

// 初始化示例收藏（仅在首次使用时）
export function initializeSampleFavorites(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(INITIALIZED_KEY)) return;
  localStorage.setItem(INITIALIZED_KEY, '1');
    const samples: Omit<Favorite, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: "简单流程图",
        code: `flowchart TD
    A[开始] --> B{判断}
    B -->|是| C[执行]
    B -->|否| D[结束]
    C --> D`,
      },
      {
        name: "我的项目架构",
        code: `flowchart LR
    subgraph 前端
        UI[用户界面]
        State[状态管理]
    end
    subgraph 后端
        API[API服务]
        DB[(数据库)]
    end
    UI --> State
    State --> API
    API --> DB`,
      },
    ];

    samples.forEach(sample => {
      addFavorite(sample.name, sample.code);
    });
}
