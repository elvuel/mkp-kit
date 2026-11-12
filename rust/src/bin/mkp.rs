fn main() {
    if let Err(error) = mkp_rust::run_cli() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
