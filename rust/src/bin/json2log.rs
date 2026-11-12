use clap::Parser;
use mkp_rust::converter::convert_json_file_to_log_file;
use mkp_rust::{MkpError, Result};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Parser)]
#[command(name = "json2log")]
#[command(about = "Compatibility wrapper around converter")]
struct Args {
    #[arg(short = 'f', long = "file")]
    input: PathBuf,
    #[arg(short = 'o', long = "output")]
    output: Option<PathBuf>,
}

fn swap_ext(path: &Path, new_ext: &str) -> PathBuf {
    let mut out = path.to_path_buf();
    out.set_extension(new_ext.trim_start_matches('.'));
    out
}

fn ensure_parent(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

fn run() -> Result<()> {
    let args = Args::parse();
    let is_json = args
        .input
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("json"))
        .unwrap_or(false);
    if !is_json {
        return Err(MkpError::InvalidArgument(format!(
            "unrecognized input extension on {:?} (expected .json)",
            args.input
        )));
    }

    let output = match args.output {
        Some(path) => {
            if path.extension().is_none() {
                let mut fixed = path;
                fixed.set_extension("log");
                fixed
            } else {
                path
            }
        }
        None => swap_ext(&args.input, ".log"),
    };

    ensure_parent(&output)?;
    convert_json_file_to_log_file(&args.input, &output)?;
    println!("{} -> {}", args.input.display(), output.display());
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("json2log: {error}");
        std::process::exit(1);
    }
}
