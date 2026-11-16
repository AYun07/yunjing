const UIDialog = /* @__PURE__ */ (() => {
  function esc(s) {
    return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function render(opts, type) {
    const o = typeof opts === "string" ? { message: opts } : opts || {};
    const root = document.createElement("div");
    root.className = "modal-overlay ui-dialog" + (o.danger ? " ui-dialog-danger" : "");
    root.style.display = "flex";
    const icon = type === "confirm" ? o.danger ? "⚠" : "❓" : type === "prompt" ? "✎" : o.danger ? "⚠" : "ℹ";
    const inputHTML = type === "prompt" ? `<input type="text" class="ui-dialog-input" id="__uidInput"
                   value="${esc(o.defaultValue)}"
                   placeholder="${esc(o.placeholder)}">` : "";
    root.innerHTML = `
            <div class="modal-box" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <span>${icon} ${esc(o.title || "提示")}</span>
                    <button class="modal-close" data-act="cancel" aria-label="关闭">✕</button>
                </div>
                <div class="modal-body">
                    <div class="ui-dialog-msg">${esc(o.message).replace(/\n/g, "<br>")}</div>
                    ${inputHTML}
                </div>
                <div class="modal-footer">
                    ${type === "alert" ? `<button class="ui-dialog-btn ui-dialog-btn-primary" data-act="ok">${esc(o.confirmText || "知道了")}</button>` : `<button class="ui-dialog-btn ui-dialog-btn-ghost" data-act="cancel">${esc(o.cancelText || "取消")}</button>
                           <button class="ui-dialog-btn ${o.danger ? "ui-dialog-btn-danger" : "ui-dialog-btn-primary"}" data-act="ok">${esc(o.confirmText || "确定")}</button>`}
                </div>
            </div>`;
    document.body.appendChild(root);
    const close = () => {
      root.remove();
      document.removeEventListener("keydown", onKey, true);
    };
    const onKey = (e) => {
      var _a;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        root.dataset.result = type === "alert" ? "ok" : "cancel";
        close();
      } else if (e.key === "Enter" && type !== "alert") {
        const tag = (((_a = document.activeElement) == null ? void 0 : _a.tagName) || "").toLowerCase();
        if (tag === "input" || tag === "button") {
          e.preventDefault();
          root.dataset.result = "ok";
          close();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    root.addEventListener("click", (e) => {
      var _a;
      if (e.target === root) {
        root.dataset.result = type === "alert" ? "ok" : "cancel";
        close();
        return;
      }
      const act = (_a = e.target.closest("[data-act]")) == null ? void 0 : _a.getAttribute("data-act");
      if (!act) return;
      root.dataset.result = act;
      close();
    });
    if (type === "prompt") {
      const input = root.querySelector(".ui-dialog-input");
      setTimeout(() => {
        var _a;
        input == null ? void 0 : input.focus();
        (_a = input == null ? void 0 : input.select) == null ? void 0 : _a.call(input);
      }, 50);
    } else {
      const btn = root.querySelector('[data-act="ok"]');
      setTimeout(() => btn == null ? void 0 : btn.focus(), 50);
    }
    return { root, close };
  }
  function wait(root, type) {
    return new Promise((resolve) => {
      const done = (val) => resolve(val);
      const ob = new MutationObserver(() => {
        var _a, _b;
        if (!root.isConnected) {
          ob.disconnect();
          if (type === "prompt") {
            done(root.dataset.result === "ok" ? (_b = (_a = root.querySelector(".ui-dialog-input")) == null ? void 0 : _a.value) != null ? _b : "" : null);
          } else {
            done(root.dataset.result === "ok");
          }
        }
      });
      ob.observe(document.body, { childList: true, subtree: false });
      setTimeout(() => {
        if (!root.isConnected) ob.disconnect();
      }, 6e4);
    });
  }
  return {
    /** 确认框 → Promise<boolean>（true=确定） */
    confirm(opts) {
      const { root } = render(opts, "confirm");
      return wait(root, "confirm");
    },
    /** 提示框 → Promise<void> */
    alert(opts) {
      const { root } = render(opts, "alert");
      return wait(root, "alert").then(() => {
      });
    },
    /** 输入框 → Promise<string|null>（null=取消，空串=确定但未填） */
    prompt(opts) {
      const { root } = render(opts, "prompt");
      return wait(root, "prompt");
    }
  };
})();
window.UIDialog = UIDialog;
