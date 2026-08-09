use super::{
    AgentAdapter, HookEntry, HookFormat, McpFormat, McpServerEntry, files_with_ext,
    managed_files_with_ext,
};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub struct GrokAdapter {
    home: PathBuf,
}

impl Default for GrokAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl GrokAdapter {
    pub fn new() -> Self {
        Self {
            home: dirs::home_dir().unwrap_or_default(),
        }
    }

    #[cfg(test)]
    pub fn with_home(home: PathBuf) -> Self {
        Self { home }
    }

    fn parse_mcp_file(path: &Path) -> Vec<McpServerEntry> {
        let Ok(content) = std::fs::read_to_string(path) else {
            return vec![];
        };
        let Ok(doc) = content.parse::<toml::Table>() else {
            return vec![];
        };
        let Some(servers) = doc.get("mcp_servers").and_then(|v| v.as_table()) else {
            return vec![];
        };
        servers
            .iter()
            .filter_map(|(name, value)| {
                let table = value.as_table()?;
                let command = table.get("command")?.as_str()?.to_string();
                let args = table
                    .get("args")
                    .and_then(|v| v.as_array())
                    .map(|values| {
                        values
                            .iter()
                            .filter_map(|value| value.as_str().map(str::to_string))
                            .collect()
                    })
                    .unwrap_or_default();
                let env = table
                    .get("env")
                    .and_then(|v| v.as_table())
                    .map(|values| {
                        values
                            .iter()
                            .filter_map(|(key, value)| {
                                value.as_str().map(|value| (key.clone(), value.to_string()))
                            })
                            .collect::<HashMap<_, _>>()
                    })
                    .unwrap_or_default();
                let display_name = table
                    .get("_hk_name")
                    .and_then(|value| value.as_str())
                    .unwrap_or(name)
                    .to_string();
                Some(McpServerEntry {
                    name: display_name,
                    command,
                    args,
                    env,
                    transport: Default::default(),
                    url: None,
                    headers: Default::default(),
                    enabled: true,
                })
            })
            .collect()
    }
}

impl AgentAdapter for GrokAdapter {
    fn name(&self) -> &str {
        "grok"
    }

    fn base_dir(&self) -> PathBuf {
        self.home.join(".grok")
    }

    fn detect(&self) -> bool {
        self.base_dir().exists()
    }

    fn skill_dirs(&self) -> Vec<PathBuf> {
        vec![self.base_dir().join("skills")]
    }

    fn mcp_config_path(&self) -> PathBuf {
        self.base_dir().join("config.toml")
    }

    fn mcp_format(&self) -> McpFormat {
        McpFormat::Toml
    }

    fn hook_config_path(&self) -> PathBuf {
        self.base_dir().join("hooks.json")
    }

    fn hook_format(&self) -> HookFormat {
        HookFormat::None
    }

    fn plugin_dirs(&self) -> Vec<PathBuf> {
        vec![]
    }

    fn read_mcp_servers(&self) -> Vec<McpServerEntry> {
        Self::parse_mcp_file(&self.mcp_config_path())
    }

    fn read_mcp_servers_from(&self, path: &Path) -> Vec<McpServerEntry> {
        Self::parse_mcp_file(path)
    }

    fn read_hooks(&self) -> Vec<HookEntry> {
        vec![]
    }

    fn global_subagent_files(&self) -> Vec<PathBuf> {
        files_with_ext(&self.base_dir().join("agents"), "md").collect()
    }

    fn global_subagent_extension_files(&self) -> Vec<PathBuf> {
        managed_files_with_ext(&self.base_dir().join("agents"), "md").collect()
    }

    fn global_command_files(&self) -> Vec<PathBuf> {
        managed_files_with_ext(&self.base_dir().join("commands"), "md").collect()
    }

    fn subagent_dir_for(&self, scope: &crate::models::ConfigScope) -> Option<PathBuf> {
        match scope {
            crate::models::ConfigScope::Global => Some(self.base_dir().join("agents")),
            crate::models::ConfigScope::Project { .. } => None,
        }
    }

    fn command_dir_for(&self, scope: &crate::models::ConfigScope) -> Option<PathBuf> {
        match scope {
            crate::models::ConfigScope::Global => Some(self.base_dir().join("commands")),
            crate::models::ConfigScope::Project { .. } => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scans_verified_global_paths_and_toml_mcp() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().join(".grok");
        std::fs::create_dir_all(base.join("agents")).unwrap();
        std::fs::create_dir_all(base.join("commands")).unwrap();
        std::fs::write(base.join("agents/reviewer.md"), "# Reviewer").unwrap();
        std::fs::write(base.join("commands/check.md"), "Check this").unwrap();
        std::fs::write(
            base.join("config.toml"),
            "[mcp_servers.demo]\ncommand = \"npx\"\nargs = [\"demo\"]\n[mcp_servers.demo.env]\nTOKEN = \"secret\"\n",
        )
        .unwrap();

        let adapter = GrokAdapter::with_home(dir.path().to_path_buf());
        assert_eq!(adapter.global_subagent_extension_files().len(), 1);
        assert_eq!(adapter.global_command_files().len(), 1);
        let servers = adapter.read_mcp_servers();
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0].name, "demo");
        assert_eq!(servers[0].args, vec!["demo"]);
        assert_eq!(
            servers[0].env.get("TOKEN").map(String::as_str),
            Some("secret")
        );
    }
}
