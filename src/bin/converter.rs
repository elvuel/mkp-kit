use clap::Parser;
use mkp_rust::converter::{
    Direction, convert_json_file_to_log_file, convert_log_file_to_json_file, direction_from_path,
};
use mkp_rust::{MkpError, Result};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Parser)]
#[command(name = "converter")]
#[command(about = "Convert between MKP .log and .json files")]
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
    let direction = direction_from_path(&args.input);
    if direction == Direction::Unknown {
        return Err(MkpError::InvalidArgument(format!(
            "unrecognized input extension on {:?} (expected .log or .json)",
            args.input
        )));
    }

    let output = match args.output {
        Some(path) => {
            if path.extension().is_none() {
                let mut fixed = path;
                fixed.set_extension(direction.target_ext().trim_start_matches('.'));
                fixed
            } else {
                path
            }
        }
        None => swap_ext(&args.input, direction.target_ext()),
    };

    ensure_parent(&output)?;
    match direction {
        Direction::LogToJson => convert_log_file_to_json_file(&args.input, &output)?,
        Direction::JsonToLog => convert_json_file_to_log_file(&args.input, &output)?,
        Direction::Unknown => unreachable!(),
    }
    println!("{} -> {}", args.input.display(), output.display());
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("converter: {error}");
        std::process::exit(1);
    }
}
