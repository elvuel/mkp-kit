plugins {
    base
}

allprojects {
    group = "io.github.elvuel.mkpkit"
    version = "0.1.0"

    repositories {
        mavenCentral()
    }
}

subprojects {
    plugins.withId("java") {
        apply(plugin = "maven-publish")

        extensions.configure<JavaPluginExtension> {
            sourceCompatibility = JavaVersion.VERSION_21
            targetCompatibility = JavaVersion.VERSION_21
        }

        tasks.withType<JavaCompile>().configureEach {
            options.encoding = "UTF-8"
            options.release = 21
        }

        tasks.withType<Test>().configureEach {
            useJUnitPlatform()
        }

        extensions.configure<PublishingExtension> {
            publications {
                create<MavenPublication>("mavenJava") {
                    from(components["java"])
                    artifactId = when (project.name) {
                        "core" -> "mkpkit-java-core"
                        "cli" -> "mkpkit-java"
                        "client" -> "mkpkit-java-client"
                        "server" -> "mkpkit-java-server"
                        "file-server" -> "mkpkit-java-file-server"
                        "converter" -> "mkpkit-java-converter"
                        "examples" -> "mkpkit-java-examples"
                        else -> project.name
                    }
                }
            }
        }
    }
}
