# TSoftObjectPtr vs TObjectPtr — Epic 官方助手权威解答

> 来源：Epic Games 官方 UE AI 助手（dev.epicgames.com 社区助手），两问在同一会话中完成
> （Conversation ID：`01KZZGMZZWAFQFD8PKNG6ECKJF`）。以下内容根据助手原始回答整理，原文为英文，
> 原始 JSON 见 `result1.json` / `result2.json`。

---

## 问题一：TSoftObjectPtr 和 TObjectPtr 有什么区别？各自的典型使用场景？

### 一句话总结

在 UE5 中，二者的选择本质上是对**内存管理**与**加载性能**的抉择：
`TObjectPtr` 是**硬引用（Hard Reference）**，`TSoftObjectPtr` 是**软引用（Soft Reference）**。

### 核心对比

| 特性 | `TObjectPtr<T>` | `TSoftObjectPtr<T>` |
| :--- | :--- | :--- |
| 引用类型 | 硬引用 | 软引用 |
| 加载行为 | 随引用者一起**自动加载** | **不会自动加载**，必须手动请求 |
| 与 GC 的关系 | 阻止对象被垃圾回收 | 不阻止（本质上是弱指针） |
| 存储内容 | 内存地址（编辑器下附带访问跟踪） | 磁盘上资产的**字符串路径**（`FSoftObjectPath`） |
| 访问方式 | 直接访问（与裸指针用法一致） | 间接访问，必须先 `Get()` / `LoadSynchronous()` 解析 |

### TObjectPtr（"硬"指针）

- UE5 中取代裸指针（`T*`）用于 `UPROPERTY` 成员声明的标准写法。
- **工作机制**：包含 `TObjectPtr` 的对象被加载时，引擎**必须立即**把被引用对象一并加载进内存。
- **典型场景**：Actor 正常运作所必需的对象，例如 Character 的 `Mesh`、武器的 `RootComponent`、Camera/SpringArm 等组件，以及 Gameplay 框架内部对象间的引用（如 PlayerState 引用 PlayerController）。
- **性能警示**：如果有 100 种武器而角色用 `TObjectPtr` 全部引用，那么生成一个角色就会把 100 件武器全部拉进内存（即"引用膨胀"）。

```cpp
UCLASS()
class MYPROJECT_API AMyActor : public AActor
{
    GENERATED_BODY()

public:
    // UE5 标准：成员变量用 TObjectPtr 代替裸指针。此 mesh 会随 Actor 加载而立即加载。
    UPROPERTY(EditAnywhere, Category = "Visuals")
    TObjectPtr<UStaticMeshComponent> PrimaryMesh;

    void DoSomething()
    {
        // 用法与裸指针完全一致
        if (PrimaryMesh)
        {
            PrimaryMesh->SetVisibility(true);
        }
    }
};
```

### TSoftObjectPtr（"软"指针）

- **工作机制**：存储的是 `FSoftObjectPath`（形如 `/Game/Meshes/MySword` 的字符串路径）。用 `.Get()` 可以检查对象是否已在内存中；返回 `nullptr` 则说明需要先加载。
- **典型场景**：
  - 可选或"重量级"资产：Boss 专属死亡动画、DLC 物品、不常显示的大尺寸 UI 贴图；
  - 皮肤/外观变体：角色可能有 50 顶帽子，只想加载当前装备的那一顶；
  - 关卡流送：引用当前未加载的子关卡中的对象。
- **收益**：显著减少内存占用与关卡加载时间，避免"引用膨胀"。

```cpp
UPROPERTY(EditAnywhere, Category = "Setup")
TSoftObjectPtr<UStaticMesh> RareDropMesh;

void AMyActor::LoadRareMesh()
{
    if (UStaticMesh* LoadedMesh = RareDropMesh.Get())   // 已在内存中（可能有缓存）
    {
        UseMesh(LoadedMesh);
    }
    else
    {
        // 方案 A：同步加载（主线程上会造成卡顿，不推荐）
        UStaticMesh* SyncMesh = RareDropMesh.LoadSynchronous();

        // 方案 B：异步加载（UE5 最佳实践，详见问题二）
        FStreamableManager& Streamable = UAssetManager::GetStreamableManager();
        Streamable.RequestAsyncLoad(RareDropMesh.ToSoftObjectPath(),
            FStreamableDelegate::CreateUObject(this, &AMyActor::OnMeshLoaded));
    }
}
```

### 如何选择

1. **内部组件和一出生就必须使用的资产** → `TObjectPtr`。
2. **数据量大、外观变体、并非每个实例都用得到的资产** → `TSoftObjectPtr`。

**实用技巧**：在 Content Browser 中用 **Size Map** 或 **Reference Viewer** 查看引用关系——实线是硬引用，虚线是软引用。如果 Size Map 显示你的 Character 拉进了 2GB 数据，多半是 `TObjectPtr` 硬引用过多，应把一部分改成 `TSoftObjectPtr`。

---

## 问题二（追问）：运行时用 TSoftObjectPtr 异步加载资源并安全使用的 C++ 示例

> 助手在同一会话中的补充回答。要点：异步加载必须管理好三样东西——
> **资产路径**（`TSoftObjectPtr`）、**加载请求**（`FStreamableHandle`）、**完成回调**（Delegate）。

### 头文件（`MyAsyncActor.h`）

关键点：用 `TSharedPtr<FStreamableHandle>` **持有句柄**。若句柄不保存、提前离开作用域，加载过程可能被取消或内存被提前释放，导致回调永远不会触发。

```cpp
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Engine/StreamableManager.h" // FStreamableHandle 所需
#include "MyAsyncActor.generated.h"

UCLASS()
class MYGAME_API AMyAsyncActor : public AActor
{
    GENERATED_BODY()

public:
    AMyAsyncActor();

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    // 软引用（编辑器中可指定资产）
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Loading")
    TSoftObjectPtr<UStaticMesh> MeshToLoad;

    // 加载完成后接收 mesh 的组件
    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UStaticMeshComponent> MeshComponent;

    void StartAsyncLoad();   // 发起异步加载
    void OnLoadCompleted();  // 加载完成回调

private:
    // 必须持有句柄的共享指针，让加载请求保持存活
    TSharedPtr<FStreamableHandle> StreamingHandle;
};
```

### 源文件（`MyAsyncActor.cpp`）

使用 `UAssetManager` 提供的全局 `FStreamableManager`——这是 UE5 访问流送功能的标准方式。

```cpp
#include "MyAsyncActor.h"
#include "Engine/AssetManager.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"

AMyAsyncActor::AMyAsyncActor()
{
    MeshComponent = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("MeshComp"));
    RootComponent = MeshComponent;
}

void AMyAsyncActor::BeginPlay()
{
    Super::BeginPlay();
    StartAsyncLoad();
}

void AMyAsyncActor::StartAsyncLoad()
{
    // 1. 安全检查：路径是否有效、是否已加载
    if (MeshToLoad.IsNull())
    {
        UE_LOG(LogTemp, Warning, TEXT("MeshToLoad is null!"));
        return;
    }

    // 2. 取得 Asset Manager 的 Streamable Manager
    FStreamableManager& Streamable = UAssetManager::GetStreamableManager();

    // 3. 发起异步加载，绑定完成回调
    StreamingHandle = Streamable.RequestAsyncLoad(
        MeshToLoad.ToSoftObjectPath(),
        FStreamableDelegate::CreateUObject(this, &AMyAsyncActor::OnLoadCompleted));

    // 4. 说明：若资产已在内存中，RequestAsyncLoad 可能立即完成，句柄仍然有效。
}

void AMyAsyncActor::OnLoadCompleted()
{
    // 1. 校验句柄
    if (!StreamingHandle.IsValid()) return;

    // 2. 二次确认资产确实加载成功（可能因文件缺失/路径损坏而失败）
    UStaticMesh* LoadedMesh = MeshToLoad.Get();

    if (LoadedMesh && MeshComponent)
    {
        MeshComponent->SetStaticMesh(LoadedMesh);
        UE_LOG(LogTemp, Log, TEXT("Successfully loaded: %s"), *LoadedMesh->GetName());
    }

    // 3. 清理句柄：不再需要保持加载请求
    StreamingHandle->ReleaseHandle();
    StreamingHandle.Reset();
}

void AMyAsyncActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    // 关键：Actor 在加载期间被销毁时必须取消句柄，
    // 防止回调在已被垃圾回收的对象上触发（最常见的崩溃来源）
    if (StreamingHandle.IsValid() && StreamingHandle->IsActive())
    {
        StreamingHandle->CancelHandle();
    }

    Super::EndPlay(EndPlayReason);
}
```

### 四大安全机制（助手强调）

1. **`TSharedPtr<FStreamableHandle>` 持有句柄**：UE5 的异步加载请求是引用计数的。若不把句柄存为类成员，引擎可能在资产加载完成前销毁它，回调将永远不触发。
2. **`EndPlay` 中 `CancelHandle()`**：发起加载后玩家就离开关卡（Actor 被销毁）是最常见的崩溃原因——`FStreamableManager` 仍会试图在已删除的对象上调用回调；取消句柄即可阻止回调触发。
3. **回调中仍要 `Get()` 后判空**：即使加载"成功"，也要检查指针是否有效，加载可能因文件缺失或资产路径损坏而失败。
4. **用完 `ReleaseHandle()`**：一旦把加载到的对象赋给了 `TObjectPtr`/`UPROPERTY`（硬引用），就可以释放流送句柄，让 `StreamableManager` 解除对资产的保护性引用。

### 其他最佳实践

- `RequestAsyncLoad` 会自动检查资产是否已在内存中，若已存在则回调立即触发，天然避免重复加载。
- 构建模块依赖：项目 `.Build.cs` 需包含 `Engine`（`FStreamableManager` 在其中）。
- 验证方法：编译后建一个基于 `MyAsyncActor` 的蓝图，给 `MeshToLoad` 指定一个较大的 Static Mesh，放入关卡按 Play 观察日志；在 BeginPlay 后立刻销毁 Actor 可验证取消逻辑。

---

## 官方参考链接

| # | 标题 | 链接 | 类型 |
|---|------|------|------|
| 1 | Object Pointers（对象指针） | https://dev.epicgames.com/documentation/unreal-engine/object-pointers-in-unreal-engine | 官方文档 |
| 2 | All about Soft and Weak pointers（软/弱指针详解） | https://dev.epicgames.com/community/learning/tutorials/kx/unreal-engine-all-about-soft-and-weak-pointers | 官方学习教程 |
| 3 | Asynchronous Asset Loading（异步资产加载） | https://dev.epicgames.com/documentation/unreal-engine/asynchronous-asset-loading-in-unreal-engine | 官方文档 |
| 4 | Referencing Assets（资产引用） | https://dev.epicgames.com/documentation/unreal-engine/referencing-assets-in-unreal-engine | 官方文档 |
