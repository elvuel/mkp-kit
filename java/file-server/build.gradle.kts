plugins {
    application
}

base {
    archivesName.set("mkpkit-java-file-server")
}

dependencies {
    implementation(project(":core"))
    implementation("com.fasterxml.jackson.core:jackson-databind:2.23.0")
}

application {
    applicationName = "mkpkit-java-file-server"
    mainClass = "io.github.elvuel.mkpkit.java.fileserver.Main"
}
