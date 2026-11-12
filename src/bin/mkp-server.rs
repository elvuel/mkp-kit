#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let settings = mkp_rust::load_settings();
    mkp_rust::run_server(settings).await?;
    Ok(())
}
