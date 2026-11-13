plugins {
    application
}

base {
    archivesName.set("mkpkit-java-client")
}

dependencies {
    implementation(project(":core"))
    implementation("com.fasterxml.jackson.core:jackson-databind:2.23.0")
}

application {
    applicationName = "mkpkit-java-client"
    mainClass = "io.github.elvuel.mkpkit.java.client.Main"
}
