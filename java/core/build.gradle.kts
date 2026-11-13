plugins {
    `java-library`
}

base {
    archivesName.set("mkpkit-java-core")
}

dependencies {
    api("com.fazecast:jSerialComm:2.11.4")
    api("com.fasterxml.jackson.core:jackson-databind:2.23.0")

    testImplementation(platform("org.junit:junit-bom:5.12.2"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
