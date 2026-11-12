package main

import (
	"context"
	"log"

	c "github.com/elvuel/mkp-kit/go/examples/commonpkg"
	"github.com/elvuel/mkp-kit/go/helper"
)

func main() {
	c.InitSFport()

	output, err := helper.AversionContext(context.Background(), c.SFPort)

	if err != nil {
		log.Fatalln(err)
	}

	c.Log(output)
}

