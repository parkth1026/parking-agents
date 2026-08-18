# UE5 Enhanced Input：在 PlayerController（C++）中添加 Input Mapping Context 并绑定移动回调

> 以下答案由 Epic Games 官方 AI 助手（dev.epicgames.com 社区助手）提供，并已核对官方文档链接。适用 UE 5.x（含 5.6）。

## 核心思路

在 PlayerController 中使用 Enhanced Input 只需要三步：

1. **Build.cs 添加 `EnhancedInput` 模块依赖**；
2. **在 `BeginPlay` 中通过 `UEnhancedInputLocalPlayerSubsystem::AddMappingContext` 注册 Input Mapping Context（IMC）**；
3. **在 `SetupInputComponent` 中把 `InputComponent` 转换为 `UEnhancedInputComponent`，用 `BindAction` 绑定移动（Move/Look）回调**。

相比在 Pawn/Character 里做，放在 PlayerController 里绑定的好处是：即使 Pawn 被销毁或切换，输入绑定依然保留。

## 1. 模块依赖（`YourProject.Build.cs`）

```csharp
PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput" });
```

## 2. 头文件 `MyPlayerController.h`

IMC 与 IA 资产用 `EditDefaultsOnly` 声明，之后在控制器蓝图子类里赋值即可：

```cpp
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "InputActionValue.h"   // FInputActionValue 所需头文件
#include "MyPlayerController.generated.h"

UCLASS()
class MYPROJECT_API AMyPlayerController : public APlayerController   // MYPROJECT_API 换成你的模块宏
{
	GENERATED_BODY()

protected:
	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;

	// --- Enhanced Input 资产 ---

	/** 默认输入映射上下文（IMC） */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
	class UInputMappingContext* DefaultMappingContext;

	/** 移动输入（WASD / 摇杆），Value Type 设为 Axis2D (Vector2D) */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
	class UInputAction* MoveAction;

	/** 视角输入（鼠标 / 摇杆），Value Type 设为 Axis2D (Vector2D) */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
	class UInputAction* LookAction;

	// --- 输入回调 ---

	/** 移动回调 */
	void Move(const FInputActionValue& Value);

	/** 视角回调 */
	void Look(const FInputActionValue& Value);
};
```

## 3. 源文件 `MyPlayerController.cpp`

```cpp
#include "MyPlayerController.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/Pawn.h"
#include "Engine/LocalPlayer.h"

void AMyPlayerController::BeginPlay()
{
	Super::BeginPlay();

	// 把 Input Mapping Context 添加到 Local Player 的 Enhanced Input 子系统
	// 注意：GetLocalPlayer() 在专用服务器或早期初始化阶段可能为空，必须判空
	if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
		ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
	{
		if (DefaultMappingContext)
		{
			// 第二个参数是优先级：数字越大优先级越高，会覆盖低优先级上下文中的同键绑定
			Subsystem->AddMappingContext(DefaultMappingContext, 0);
		}
	}
}

void AMyPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();

	// PlayerController 默认创建的 InputComponent 就是 UEnhancedInputComponent（启用 Enhanced Input 插件时）
	if (UEnhancedInputComponent* EnhancedInputComponent = Cast<UEnhancedInputComponent>(InputComponent))
	{
		// Triggered：按住期间每帧触发，适合移动/视角这类连续输入
		if (MoveAction)
		{
			EnhancedInputComponent->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AMyPlayerController::Move);
		}

		if (LookAction)
		{
			EnhancedInputComponent->BindAction(LookAction, ETriggerEvent::Triggered, this, &AMyPlayerController::Look);
		}
	}
}

void AMyPlayerController::Move(const FInputActionValue& Value)
{
	// X = 右/左，Y = 前/后
	FVector2D MovementVector = Value.Get<FVector2D>();

	if (APawn* ControlledPawn = GetPawn())
	{
		// 以控制器朝向（只取 Yaw）为基准计算前/右方向
		const FRotator Rotation = GetControlRotation();
		const FRotator YawRotation(0.0, Rotation.Yaw, 0.0);

		const FVector ForwardDirection = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
		const FVector RightDirection   = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);

		ControlledPawn->AddMovementInput(ForwardDirection, MovementVector.Y);
		ControlledPawn->AddMovementInput(RightDirection,   MovementVector.X);
	}
}

void AMyPlayerController::Look(const FInputActionValue& Value)
{
	// X = 水平（Yaw），Y = 垂直（Pitch）
	FVector2D LookAxisVector = Value.Get<FVector2D>();

	AddYawInput(LookAxisVector.X);
	AddPitchInput(LookAxisVector.Y);
}
```

## 4. 编辑器配置步骤

1. **创建 Input Action**：内容浏览器右键 → Input → Input Action，创建 `IA_Move` 和 `IA_Look`，二者的 **Value Type 都设为 Axis2D (Vector2D)**。
2. **创建 Input Mapping Context**：右键 → Input → Input Mapping Context，创建 `IMC_Default`；把 `IA_Move` 映射到 W/A/S/D，`IA_Look` 映射到 Mouse XY（2D 轴）。
3. **创建蓝图控制器**：基于 `AMyPlayerController` 创建蓝图子类。
4. **赋值资产**：在蓝图 Details 面板的 Input 分类下，赋值 `DefaultMappingContext`、`MoveAction`、`LookAction`。
5. **设置 GameMode**：把 GameMode 的 Player Controller Class 设为该蓝图。

## 关键注意点（来自官方助手回答）

- **触发事件选择**：移动/视角这类连续输入用 `ETriggerEvent::Triggered`；跳跃等瞬时动作用 `ETriggerEvent::Started`。
- **判空**：`GetLocalPlayer()` 与 Subsystem 在专用服务器或初始化早期可能为空，务必判空；Enhanced Input 是客户端侧功能。
- **优先级**：`AddMappingContext` 的第二个参数是优先级，数值越高越能覆盖低优先级上下文里的同名按键映射。
- **网络**：在 Character 上使用 `AddMovementInput` / `AddControllerYawInput` 时，输入会自动从客户端复制到服务器。

## 官方文档链接

- [Input Overview（官方文档，Epic 助手引用）](https://dev.epicgames.com/documentation/unreal-engine/input-overview-in-unreal-engine)
- [Enhanced Input in Unreal Engine（官方文档，Enhanced Input 详解）](https://dev.epicgames.com/documentation/en-us/unreal-engine/enhanced-input-in-unreal-engine)
- [Enhanced Input Binding with Gameplay Tags C++（官方社区教程，Epic 助手引用，Lyra 式绑定方案）](https://dev.epicgames.com/community/learning/tutorials/aqrD/unreal-engine-enhanced-input-binding-with-gameplay-tags-c)

> 以上三个链接均已验证可访问（HTTP 200）。
