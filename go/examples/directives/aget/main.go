package main

import (
	"context"
	"log"
	"os"
	"time"

	mkpgo "github.com/elvuel/mkp-kit/go"
	c "github.com/elvuel/mkp-kit/go/examples/commonpkg"
	"github.com/elvuel/mkp-kit/go/helper"
)

func main() {
	if len(os.Args) != 2 {
		log.Fatalf("usage: %s <file-server-path>", os.Args[0])
	}

	c.InitSFport()

	output, err := helper.AUploadToMKPContext(
		context.Background(),
		c.SFPort,
		&mkpgo.AGetOption{FilePath: os.Args[1]},
		mkpgo.WithSyncOutputTimeout(30*time.Second),
	)
	if err != nil {
		log.Fatalln(err)
	}

	c.Log(output)
}

