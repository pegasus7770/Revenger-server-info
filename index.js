(() => {
  const patches = [];

  function showServerInfo(guild) {
    const v = window.vendetta;
    const RN = v.metro.common.ReactNative;
    const UserStore = v.metro.findByStoreName("UserStore");
    const MemberStore = v.metro.findByStoreName("GuildMemberCountStore");
    const LazySheet = v.metro.findByProps("openLazy", "hideActionSheet");
    const showToast = v.ui.toasts.showToast;

    LazySheet?.hideActionSheet?.();

    const owner = guild?.ownerId ? UserStore?.getUser?.(guild.ownerId) : null;
    const ownerText = owner ? `${owner.username} (${guild.ownerId})` : (guild?.ownerId || "Unknown");
    const members = MemberStore?.getMemberCount?.(guild?.id) ?? guild?.memberCount ?? "N/A";
    const roles = guild?.roles ? Object.keys(guild.roles).length : 0;

    const text = [
      `Server: ${guild?.name || "Unknown"}`,
      `ID: ${guild?.id || "N/A"}`,
      `Owner: ${ownerText}`,
      `Members: ${members}`,
      `Roles: ${roles}`,
      `Boost Level: ${guild?.premiumTier ?? 0} (${guild?.premiumSubscriptionCount ?? 0} boosts)`
    ].join("\n");

    setTimeout(() => {
      RN.Alert.alert("Server Settings & Inspector", text, [
        {
          text: "Copy ID",
          onPress: () => {
            RN.Clipboard.setString(String(guild?.id || ""));
            showToast?.("Server ID copied!");
          }
        },
        {
          text: "Open Server Settings",
          onPress: () => {
            const mod = v.metro.findByProps("openGuildSettings") || v.metro.findByProps("transitionToGuildSettings");
            if (mod?.openGuildSettings) mod.openGuildSettings(guild.id);
            else if (mod?.transitionToGuildSettings) mod.transitionToGuildSettings(guild.id);
            else showToast?.("Native settings restricted on this server.");
          }
        },
        { text: "Close", style: "cancel" }
      ]);
    }, 150);
  }

  return {
    onLoad() {
      const v = window.vendetta;
      const LazySheet = v.metro.findByProps("openLazy", "hideActionSheet");
      const SelectedGuildStore = v.metro.findByStoreName("SelectedGuildStore");
      const GuildStore = v.metro.findByStoreName("GuildStore");
      if (!LazySheet?.openLazy) return;

      patches.push(
        v.patcher.before("openLazy", LazySheet, (args) => {
          const [promise, sheetName, params] = args;
          if (!promise?.then) return;
          const name = typeof sheetName === "string" ? sheetName.toLowerCase() : "";
          if (name.includes("message") || name.includes("user") || name.includes("emoji")) return;

          args[0] = promise.then((mod) => {
            if (!mod?.default || mod.__siPatched) return mod;
            mod.__siPatched = true;

            patches.push(
              v.patcher.after("default", mod, (sheetArgs, res) => {
                try {
                  const React = v.metro.common.React;
                  const props = sheetArgs?.[0] || {};
                  const guildId = props.guild?.id || props.guildId || params?.guild?.id || params?.guildId || SelectedGuildStore?.getGuildId?.();
                  if (!guildId) return;

                  const guild = props.guild || params?.guild || GuildStore?.getGuild?.(guildId);
                  if (!guild) return;

                  const walk = (node, d = 25) => {
                    if (!node || d <= 0) return null;
                    const ch = node?.props?.children;
                    if (Array.isArray(ch) && ch.some((c) => c && typeof c === "object" && c.type && typeof c.props?.label === "string")) {
                      return node;
                    }
                    if (Array.isArray(ch)) {
                      for (const item of ch) {
                        const f = walk(item, d - 1);
                        if (f) return f;
                      }
                    } else if (ch && typeof ch === "object") {
                      return walk(ch, d - 1);
                    }
                    return null;
                  };

                  const container = walk(res);
                  if (!container || container.props.children.some((c) => c?.key === "si-btn")) return;

                  const sample = container.props.children.find((c) => c && typeof c === "object" && c.type && typeof c.props?.label === "string");
                  const Row = sample?.type || v.ui.components.Forms.FormRow;
                  const icon = v.ui.assets.getAssetIDByName("ic_cog_24px") || v.ui.assets.getAssetIDByName("SettingsIcon");

                  container.props.children.unshift(
                    React.createElement(Row, {
                      key: "si-btn",
                      label: "Server Settings & Inspector",
                      subLabel: `ID: ${guild.id}`,
                      icon,
                      onPress: () => showServerInfo(guild)
                    })
                  );
                } catch {}
              })
            );
            return mod;
          });
        })
      );
    },
    onUnload() {
      while (patches.length) {
        try { patches.pop()(); } catch {}
      }
    },
    settings() {
      const v = window.vendetta;
      const { React } = v.metro.common;
      const { Forms } = v.ui.components;
      const SelectedGuildStore = v.metro.findByStoreName("SelectedGuildStore");
      const GuildStore = v.metro.findByStoreName("GuildStore");
      const guildId = SelectedGuildStore?.getGuildId?.();
      const guild = guildId ? GuildStore?.getGuild?.(guildId) : null;

      return React.createElement(
        Forms.FormSection,
        { title: "ServerInspector" },
        React.createElement(Forms.FormRow, {
          label: "Inspect Current Server",
          subLabel: guild ? `${guild.name} (${guild.id})` : "Open any server first",
          onPress: () => {
            if (guild) showServerInfo(guild);
            else v.ui.toasts.showToast("Open a server first.");
          }
        })
      );
    }
  };
})()
