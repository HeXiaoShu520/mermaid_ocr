export type Template = {
  name: string;
  code: string;
};

export type TemplateCategory = {
  name: string;
  templates: Template[];
};

export const templateCategories: TemplateCategory[] = [
  {
    name: "通用示例",
    templates: [
      {
        name: "流程图",
        code: `flowchart TD
    A[用户进入系统] --> B{选择操作}
    B --> C[编写代码]
    B --> D[使用AI生成]
    C --> E[编辑代码]
    C --> F[导出图表]
    D --> G[输入查询]
    D --> H[复制代码]
    subgraph 使用AI
        G --> H
    end
    subgraph 使用编辑器
        C --> E
        E --> F
    end`,
      },
      {
        name: "时序图",
        code: `sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant B as 后端
    participant D as 数据库
    U->>F: 点击登录
    F->>B: POST /login
    B->>D: 查询用户
    D-->>B: 返回用户信息
    B-->>F: 返回 Token
    F-->>U: 跳转首页`,
      },
      {
        name: "类图",
        code: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +fetch()
    }
    class Cat {
        +purr()
    }
    Animal <|-- Dog
    Animal <|-- Cat`,
      },
      {
        name: "状态图",
        code: `stateDiagram-v2
    [*] --> 空闲
    空闲 --> 生成中
    生成中 --> [*]
    生成中 --> 审查中
    审查中 --> 编辑中
    编辑中 --> 保存中
    保存中 --> [*]`,
      },
      {
        name: "甘特图",
        code: `gantt
    title 项目时间线
    dateFormat  YYYY-MM-DD
    section 开发
    初始设置           :done, a1, 2024-01-01, 30d
    功能集成          :active, after a1, 40d
    测试和QA          :q1, after a1, 20d
    section 部署
    用户测试            :2024-04-01, 20d
    最终发布           :2024-05-01, 10d`,
      },
      {
        name: "饼图",
        code: `pie title 功能使用分布
    "图表生成" : 50
    "代码编辑" : 20
    "文件下载" : 15
    "用户项目" : 15`,
      },
      {
        name: "实体关系图",
        code: `erDiagram
    USER ||--o{ PROJECT : creates
    USER ||--o{ DIAGRAM : "has access"
    PROJECT ||--o{ DIAGRAM : contains
    DIAGRAM ||--|{ FILE : "exports to"
    FILE ||--|{ TYPE : "has format"`,
      },
      {
        name: "象限图",
        code: `quadrantChart
    title 功能影响分析
    x-axis Low Impact --> High Impact
    y-axis Low Usage --> High Usage
    quadrant-1 "必须保留"
    quadrant-2 "需要改进"
    quadrant-3 "考虑移除"
    quadrant-4 "监控使用"
    "核心功能": [0.9, 0.8]
    "AI集成": [0.85, 0.6]
    "代码编辑": [0.7, 0.5]
    "文件导出": [0.4, 0.7]`,
      },
      {
        name: "XY图表",
        code: `xychart-beta
    title "用户增长趋势"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    y-axis "Users" 0 --> 5000
    bar [200, 400, 800, 1500, 3000, 5000]
    line [200, 400, 800, 1500, 3000, 5000]`,
      },
      {
        name: "树形图",
        code: `treeView-beta
  root[项目结构]
    src[源代码]
      components[组件]
        Header[头部]
        Footer[底部]
      lib[工具库]
        utils[工具函数]
        hooks[自定义Hook]
    public[静态资源]
      images[图片]
      fonts[字体]
    docs[文档]`,
      },
      {
        name: "块图",
        code: `block-beta
  columns 3
  A["前端"] B["API网关"] C["后端服务"]
  space D[("数据库")] space
  E["CDN"] space F[["缓存"]]`,
      },
      {
        name: "数据包图",
        code: `packet-beta
  0-7: "源端口"
  8-15: "目标端口"
  16-31: "序列号"
  32-47: "确认号"
  48-51: "数据偏移"
  52-55: "保留"
  56-63: "控制位"
  64-79: "窗口大小"
  80-95: "校验和"
  96-111: "紧急指针"`,
      },
      {
        name: "看板",
        code: `kanban
  todo[待办]
    task1[需求分析]
    task2[UI设计]
    task3[接口文档]
  doing[进行中]
    task4[前端开发]@{ assigned: '张三' }
    task5[后端开发]@{ assigned: '李四' }
  review[评审]
    task6[代码审查]
  done[已完成]
    task7[环境搭建]
    task8[技术选型]`,
      },
    ],
  },
  {
    name: "车载 AUTOSAR",
    templates: [
      {
        name: "ECU启动流程",
        code: `flowchart TD
    A[ECU上电] --> B[MCAL初始化]
    B --> C[BSW初始化]
    C --> D[OS启动]
    D --> E[RTE初始化]
    E --> F[应用层SWC启动]
    F --> G[读取传感器信号]
    G --> H[执行控制算法]
    H --> I[输出执行器控制命令]`,
      },
      {
        name: "AUTOSAR分层架构",
        code: `flowchart TB
    subgraph Application_Layer[应用层]
        SWC1[SWC: 发动机控制]
        SWC2[SWC: 制动控制]
        SWC3[SWC: 车辆状态管理]
    end
    subgraph RTE_Layer[RTE运行时环境]
        RTE[RTE]
    end
    subgraph BSW_Layer[基础软件层]
        COM[COM通信栈]
        DCM[DCM诊断]
        NVM[NvM存储]
        OS[操作系统]
        MCAL[MCAL驱动]
    end
    SWC1 --> RTE
    SWC2 --> RTE
    SWC3 --> RTE
    RTE --> COM
    RTE --> DCM
    RTE --> NVM
    COM --> OS
    DCM --> OS
    NVM --> MCAL
    OS --> MCAL`,
      },
      {
        name: "ECU通信时序",
        code: `sequenceDiagram
    participant Sensor as 车轮速度传感器
    participant SWC as 制动SWC
    participant RTE as RTE
    participant COM as COM通信栈
    participant CAN as CAN驱动
    participant ECU2 as ABS ECU
    Sensor->>SWC: 上传车轮转速
    SWC->>RTE: 请求发送制动数据
    RTE->>COM: 调用发送接口
    COM->>CAN: 封装CAN报文
    CAN->>ECU2: 发送报文
    ECU2-->>CAN: 应答
    CAN-->>COM: 发送完成
    COM-->>RTE: 返回状态
    RTE-->>SWC: 通知发送成功`,
      },
      {
        name: "ECU工作模式",
        code: `stateDiagram-v2
    [*] --> OFF
    OFF --> STARTUP : 点火上电
    STARTUP --> RUN : 初始化完成
    RUN --> POST_RUN : 熄火后收尾
    POST_RUN --> SLEEP : 进入低功耗
    SLEEP --> STARTUP : 唤醒
    RUN --> FAULT : 检测到严重故障
    FAULT --> OFF : 断电`,
      },
      {
        name: "SWC组件关系",
        code: `flowchart LR
    DriverInput[驾驶员输入SWC] --> VehicleCtrl[车辆控制SWC]
    SpeedSensor[速度传感器SWC] --> VehicleCtrl
    VehicleCtrl --> TorqueCtrl[扭矩控制SWC]
    VehicleCtrl --> BrakeCtrl[制动控制SWC]
    TorqueCtrl --> ActuatorIf[执行器接口SWC]
    BrakeCtrl --> ActuatorIf`,
      },
      {
        name: "信号数据流",
        code: `flowchart LR
    Sensor[传感器] --> Adc[ADC驱动]
    Adc --> IoHwAb[IoHwAb]
    IoHwAb --> RTE
    RTE --> SwcFilter[SWC:信号滤波]
    SwcFilter --> SwcCtrl[SWC:控制逻辑]
    SwcCtrl --> Pwm[PWM驱动]
    Pwm --> Actuator[执行器]`,
      },
      {
        name: "ECU网络拓扑",
        code: `flowchart LR
    ECU1[动力总成ECU]
    ECU2[制动ECU]
    ECU3[车身ECU]
    ECU4[ADAS ECU]
    GW[网关]
    ECU1 <-->|CAN| GW
    ECU2 <-->|CAN| GW
    ECU3 <-->|LIN/CAN| GW
    ECU4 <-->|Ethernet| GW`,
      },
      {
        name: "故障处理流程",
        code: `flowchart TD
    A[检测到传感器异常] --> B{是否持续N次?}
    B -- 否 --> C[忽略本次抖动]
    B -- 是 --> D[置位DTC]
    D --> E[进入降级模式]
    E --> F[通过DCM上报诊断信息]
    F --> G[等待维修或复位]`,
      },
      {
        name: "OS任务调度",
        code: `flowchart TB
    Task1[Task 1ms] --> Run1[Runnable:读取传感器]
    Task2[Task 10ms] --> Run2[Runnable:车辆状态计算]
    Task3[Task 20ms] --> Run3[Runnable:扭矩输出]
    Task4[Task 100ms] --> Run4[Runnable:诊断]`,
      },
      {
        name: "CAN通信路径",
        code: `flowchart LR
    AppTx[发送端SWC] --> RTE1[RTE]
    RTE1 --> COM[COM]
    COM --> PduR[PduR]
    PduR --> CanIf[CanIf]
    CanIf --> CanDrv[CAN驱动]
    CanDrv --> Bus[CAN总线]
    Bus --> CanDrv2[CAN驱动]
    CanDrv2 --> CanIf2[CanIf]
    CanIf2 --> PduR2[PduR]
    PduR2 --> COM2[COM]
    COM2 --> RTE2[RTE]
    RTE2 --> AppRx[接收端SWC]`,
      },
      {
        name: "AUTOSAR完整架构",
        code: `flowchart TB
    subgraph APP[应用层]
        SWC1[SWC: 制动控制]
        SWC2[SWC: 车辆状态]
        SWC3[SWC: 诊断适配器]
    end
    subgraph RTE_LAYER[RTE层]
        RTE[RTE]
    end
    subgraph SERVICE[服务层]
        DCM[DCM]
        DEM[DEM]
        NVM[NvM]
        COM[COM]
    end
    subgraph ECU_ABSTRACTION[ECU抽象层]
        CANIF[CanIf]
        IOHW[IoHwAb]
    end
    subgraph MCAL_LAYER[MCAL]
        CANDRV[CAN驱动]
        ADC[ADC驱动]
        PWM[PWM驱动]
    end
    SWC1 --> RTE
    SWC2 --> RTE
    SWC3 --> RTE
    RTE --> DCM
    RTE --> DEM
    RTE --> NVM
    RTE --> COM
    RTE --> IOHW
    COM --> CANIF
    IOHW --> ADC
    IOHW --> PWM
    CANIF --> CANDRV`,
      },
    ],
  },
];
