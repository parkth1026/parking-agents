namespace SshLink;

// Windows mutex ownership is thread-affine. Keep ownership on a dedicated thread
// while the orchestrator performs asynchronous subprocess/network work.
public sealed class MutationLock : IDisposable
{
    readonly ManualResetEventSlim ready = new(false), release = new(false);
    readonly Thread thread;
    Exception? error;
    public MutationLock()
    {
        thread = new Thread(() =>
        {
            Mutex? mutex = null; bool held = false;
            try
            {
                mutex = new Mutex(false, @"Global\WindowsSshWizardMutation");
                try { held = mutex.WaitOne(0); } catch (AbandonedMutexException) { held = true; }
                if (!held) throw new InvalidOperationException("其他实例正在修改 SSH，请等待完成。");
            }
            catch (Exception ex) { error = ex; }
            finally { ready.Set(); }
            if (held) { release.Wait(); mutex!.ReleaseMutex(); }
            mutex?.Dispose();
        }) { IsBackground = true, Name = "ssh-link-mutation-lock" };
        thread.Start(); ready.Wait();
        if (error != null) { thread.Join(); ready.Dispose(); release.Dispose(); throw new IOException("无法获得配置锁。", error); }
    }
    public void Dispose() { release.Set(); thread.Join(); ready.Dispose(); release.Dispose(); }
}
