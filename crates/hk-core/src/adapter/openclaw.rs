use super::{AgentAdapter, HookEntry, HookFormat, McpServerEntry};
use std::path::PathBuf;

/// Conservative OpenClaw adapter.
///
/// Skills are the only capability enabled unconditionally. OpenClaw MCP
/// support varies by installed CLI version, so this adapter deliberately
/// returns no MCP entries until a version/capability probe is introduced.
/// Subagents, commands, plugins and hooks likewise remain unsupported.
pub struct OpenClawAdapter {
    home: PathBuf,
}

impl Default for OpenClawAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenClawAdapter {
    pub fn new() -> Self {
        Self {
            home: dirs::home_dir().unwrap_or_default(),
        }
    }

    #[cfg(test)]
    pub fn with_home(home: PathBuf) -> Self {
        Self { home }
    }
}

impl AgentAdapter for OpenClawAdapter {
    fn name(&self) -> &str {
        "openclaw"
    }

    fn base_dir(&self) -> PathBuf {
        self.home.join(".openclaw")
    }

    fn detect(&self) -> bool {
        self.base_dir().exists()
    }

    fn skill_dirs(&self) -> Vec<PathBuf> {
        vec![self.base_dir().join("skills")]
    }

    fn mcp_config_path(&self) -> PathBuf {
        self.base_dir().join("openclaw.json")
    }

    fn supports_mcp(&self) -> bool {
        false
    }

    fn hook_config_path(&self) -> PathBuf {
        self.base_dir().join("openclaw.json")
    }

    fn hook_format(&self) -> HookFormat {
        HookFormat::None
    }

    fn plugin_dirs(&self) -> Vec<PathBuf> {
        vec![]
    }

    fn read_mcp_servers(&self) -> Vec<McpServerEntry> {
        vec![]
    }

    fn read_hooks(&self) -> Vec<HookEntry> {
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_only_verified_skill_contract() {
        let dir = tempfile::tempdir().unwrap();
        let adapter = OpenClawAdapter::with_home(dir.path().to_path_buf());
        assert_eq!(
            adapter.skill_dirs(),
            vec![dir.path().join(".openclaw/skills")]
        );
        assert!(adapter.global_subagent_extension_files().is_empty());
        assert!(adapter.global_command_files().is_empty());
        assert!(adapter.project_skill_dirs().is_empty());
        assert!(adapter.read_mcp_servers().is_empty());
    }
}
