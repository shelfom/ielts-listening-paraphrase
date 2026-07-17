export function initApp(): void {
  const app = document.getElementById('app');

  if (!app) {
    console.error('App element not found');
    return;
  }

  app.innerHTML = `
    <div class="flex h-full items-center justify-center bg-background text-foreground transition-colors duration-300 dark:bg-background dark:text-foreground overflow-hidden min-h-screen">
      <main class="flex w-full h-full max-w-3xl flex-col items-center justify-center px-16 py-32 sm:items-center">
        <div class="flex flex-col items-center justify-between gap-4">
          <img
            src="https://lf-coze-web-cdn.coze.cn/obj/eden-cn/lm-lgvj/ljhwZthlaukjlkulzlp/coze-coding/icon/coze-coding.gif"
            alt="扣子编程 Logo"
            width={156}
            height={130}
            style="width: 156px; height: 130px; object-fit: contain;"
          />
          <div>
            <div class="flex flex-col items-center gap-2 text-center sm:items-center sm:text-center">
              <h1 class="max-w-xl text-base font-semibold leading-tight tracking-tight text-foreground dark:text-foreground">
                应用开发中
              </h1>
              <p class="max-w-2xl text-sm-14 leading-8 text-muted-foreground dark:text-muted-foreground">
                请稍后，页面即将呈现
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;
}
