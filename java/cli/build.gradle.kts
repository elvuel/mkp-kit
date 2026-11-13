plugins {
    application
}

base {
    archivesName.set("mkpkit-java")
}

dependencies {
    implementation(project(":core"))
    implementation("com.fasterxml.jackson.core:jackson-databind:2.23.0")
}

application {
    applicationName = "mkpkit-java"
    mainClass = "io.github.elvuel.mkpkit.java.cli.Main"
}
