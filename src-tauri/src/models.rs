use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ClipType {
    Text,
    Url,
    Image,
    Code,
}

impl std::fmt::Display for ClipType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClipType::Text => write!(f, "text"),
            ClipType::Url => write!(f, "url"),
            ClipType::Image => write!(f, "image"),
            ClipType::Code => write!(f, "code"),
        }
    }
}

impl From<&str> for ClipType {
    fn from(s: &str) -> Self {
        match s {
            "url" => ClipType::Url,
            "image" => ClipType::Image,
            "code" => ClipType::Code,
            _ => ClipType::Text,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipItem {
    pub id: i64,
    pub content: String,
    pub content_hash: String,
    pub clip_type: String,
    pub source_app: Option<String>,
    pub created_at: String,
    pub is_pinned: bool,
    pub tags: Vec<String>,
    pub ogp_title: Option<String>,
    pub ogp_image: Option<String>,
    pub ogp_domain: Option<String>,
    pub image_data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OgpData {
    pub title: Option<String>,
    pub image: Option<String>,
    pub domain: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: i64,
    pub trigger: String,
    pub content: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchOptions {
    pub query: Option<String>,
    pub clip_type: Option<String>,
    pub tag: Option<String>,
    pub pinned_only: bool,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}
